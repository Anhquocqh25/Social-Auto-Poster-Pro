import fs from 'fs';
import path from 'path';
import { app, dialog } from 'electron';
import type prismaClientPackage from '@prisma/client';
import {
  APP_DATABASE_FILENAME,
  CURRENT_DATABASE_SCHEMA_VERSION,
  REQUIRED_DATABASE_TABLES,
  REQUIRED_POST_TARGET_COLUMNS,
  REQUIRED_PUBLISH_JOB_COLUMNS,
  RUNTIME_TEMPLATE_FILENAME,
} from './constants';
import { runMigrations } from './runMigrations';

export type RuntimeDatabaseContext = {
  databasePath: string;
  databaseUrl: string;
  mode: 'development' | 'packaged';
  templatePath: string | null;
};

export type RuntimeDatabaseValidationResult = {
  databasePath: string;
  schemaVersion: number;
  migrated: boolean;
  migrationBackupPath: string | null;
  writable: boolean;
};

type PrismaClientLike = Pick<
  InstanceType<typeof prismaClientPackage.PrismaClient>,
  '$queryRawUnsafe' | '$executeRawUnsafe'
>;

type TableColumnInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

function toPrismaSqliteUrl(filePath: string) {
  return `file:${filePath}`;
}

export function resolveDevelopmentDatabasePath(projectRoot: string) {
  return path.join(projectRoot, 'prisma', 'dev.db');
}

export function resolvePackagedDatabasePath() {
  return path.join(app.getPath('userData'), APP_DATABASE_FILENAME);
}

export function resolveRuntimeTemplatePath(projectRoot: string, isPackaged: boolean) {
  if (isPackaged) {
    return path.join(process.resourcesPath, 'runtime-db', RUNTIME_TEMPLATE_FILENAME);
  }

  return path.join(projectRoot, 'build-resources', 'runtime-db', RUNTIME_TEMPLATE_FILENAME);
}

export function resolveRuntimeDatabaseContext(projectRoot: string): RuntimeDatabaseContext {
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

  if (isDev) {
    const databasePath = resolveDevelopmentDatabasePath(projectRoot);

    return {
      databasePath,
      databaseUrl: 'file:./dev.db',
      mode: 'development',
      templatePath: null,
    };
  }

  const databasePath = resolvePackagedDatabasePath();

  return {
    databasePath,
    databaseUrl: toPrismaSqliteUrl(databasePath),
    mode: 'packaged',
    templatePath: resolveRuntimeTemplatePath(projectRoot, app.isPackaged),
  };
}

function ensureDirectoryExists(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function ensurePackagedTemplateExists(templatePath: string) {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Runtime database template not found: ${templatePath}`);
  }
}

function copyTemplateAtomically(templatePath: string, targetDatabasePath: string) {
  const targetDirectory = path.dirname(targetDatabasePath);
  const tempPath = path.join(
    targetDirectory,
    `${APP_DATABASE_FILENAME}.tmp-${process.pid}-${Date.now()}`
  );

  try {
    fs.copyFileSync(templatePath, tempPath);
    fs.renameSync(tempPath, targetDatabasePath);
  } catch (error) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    throw error;
  }
}

export function preparePackagedDatabase(context: RuntimeDatabaseContext) {
  if (context.mode !== 'packaged') {
    return;
  }

  ensureDirectoryExists(context.databasePath);

  if (fs.existsSync(context.databasePath)) {
    return;
  }

  if (!context.templatePath) {
    throw new Error('Packaged runtime database template path is not configured.');
  }

  ensurePackagedTemplateExists(context.templatePath);
  copyTemplateAtomically(context.templatePath, context.databasePath);
}

function getUserVersionValue(row: unknown) {
  if (!row || typeof row !== 'object') {
    return 0;
  }

  const record = row as Record<string, unknown>;
  return Number(record.user_version ?? record.userVersion ?? Object.values(record)[0] ?? 0);
}

async function getTableColumns(prisma: PrismaClientLike, tableName: string) {
  const rows = await prisma.$queryRawUnsafe<TableColumnInfoRow[]>(
    `PRAGMA table_info('${tableName}')`
  );

  return new Set(rows.map((row) => row.name));
}

async function assertRequiredColumns(
  prisma: PrismaClientLike,
  tableName: string,
  requiredColumns: readonly string[]
) {
  const columnNames = await getTableColumns(prisma, tableName);

  for (const column of requiredColumns) {
    if (!columnNames.has(column)) {
      throw new Error(`Required database column is missing: ${tableName}.${column}`);
    }
  }
}

export async function validateRuntimeDatabase(
  context: RuntimeDatabaseContext,
  prisma: PrismaClientLike
): Promise<RuntimeDatabaseValidationResult> {
  const sqliteMasterRows = await prisma.$queryRawUnsafe<
    Array<{ name: string }>
  >("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC");
  const tableNames = new Set(sqliteMasterRows.map((row) => row.name));

  for (const table of REQUIRED_DATABASE_TABLES) {
    if (!tableNames.has(table)) {
      throw new Error(`Required database table is missing: ${table}`);
    }
  }

  const versionRows = await prisma.$queryRawUnsafe<unknown[]>('PRAGMA user_version');
  const schemaVersion = getUserVersionValue(Array.isArray(versionRows) ? versionRows[0] : versionRows);

  if (schemaVersion > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${schemaVersion} is newer than supported version ${CURRENT_DATABASE_SCHEMA_VERSION}.`
    );
  }

  const migration = await runMigrations({
    databasePath: context.databasePath,
    currentVersion: schemaVersion,
    prisma,
  });

  await assertRequiredColumns(prisma, 'PostTarget', REQUIRED_POST_TARGET_COLUMNS);
  await assertRequiredColumns(prisma, 'PublishJob', REQUIRED_PUBLISH_JOB_COLUMNS);

  await prisma.$queryRawUnsafe('SELECT 1');
  await fs.promises.access(context.databasePath, fs.constants.R_OK | fs.constants.W_OK);

  return {
    databasePath: context.databasePath,
    schemaVersion: migration.targetVersion,
    migrated: migration.migrated,
    migrationBackupPath: migration.backupPath,
    writable: true,
  };
}

export function showDatabaseInitializationError(error: unknown, databasePath: string) {
  const message =
    error instanceof Error ? error.message : 'Unknown database initialization error.';
  const logPath = app.getPath('logs');

  dialog.showErrorBox(
    'Social Auto Poster Pro database initialization failed',
    [
      'Social Auto Poster Pro could not initialize its local database.',
      'Your existing data was not deleted or overwritten.',
      '',
      `Database path: ${databasePath}`,
      `Log path: ${logPath}`,
      '',
      `Technical reason: ${message}`,
    ].join('\n')
  );
}