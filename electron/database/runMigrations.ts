import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type prismaClientPackage from '@prisma/client';
import {
  CURRENT_DATABASE_SCHEMA_VERSION,
  REQUIRED_POST_TARGET_COLUMNS,
  REQUIRED_PUBLISH_JOB_COLUMNS,
} from './constants';

function getBackupDirectory() {
  return path.join(app.getPath('userData'), 'backups');
}

type PrismaClientLike = Pick<
  InstanceType<typeof prismaClientPackage.PrismaClient>,
  '$executeRawUnsafe' | '$queryRawUnsafe'
>;

type TableColumnInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

async function createTimestampedBackup(databasePath: string) {
  const backupDirectory = getBackupDirectory();
  fs.mkdirSync(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    backupDirectory,
    `social-auto-poster-pro-${timestamp}.db`
  );

  fs.copyFileSync(databasePath, backupPath);

  return backupPath;
}

async function getTableColumns(prisma: PrismaClientLike, tableName: string) {
  const rows = await prisma.$queryRawUnsafe<TableColumnInfoRow[]>(
    `PRAGMA table_info('${tableName}')`
  );

  return new Set(rows.map((row) => row.name));
}

async function createPostTargetIndexes(prisma: PrismaClientLike) {
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PostTarget_status_idx" ON "PostTarget"("status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PostTarget_accountId_pageId_idx" ON "PostTarget"("accountId", "pageId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "PostTarget_postId_accountId_pageId_key" ON "PostTarget"("postId", "accountId", "pageId")'
  );
}

async function createPublishJobIndexes(prisma: PrismaClientLike) {
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PublishJob_status_idx" ON "PublishJob"("status")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PublishJob_nextRetryAt_idx" ON "PublishJob"("nextRetryAt")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PublishJob_postId_idx" ON "PublishJob"("postId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PublishJob_accountId_idx" ON "PublishJob"("accountId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE INDEX IF NOT EXISTS "PublishJob_accountId_pageId_idx" ON "PublishJob"("accountId", "pageId")'
  );
  await prisma.$executeRawUnsafe(
    'CREATE UNIQUE INDEX IF NOT EXISTS "PublishJob_postId_accountId_pageId_key" ON "PublishJob"("postId", "accountId", "pageId")'
  );
}

async function ensureRequiredColumns(
  prisma: PrismaClientLike,
  tableName: string,
  requiredColumns: readonly string[]
) {
  const existingColumns = await getTableColumns(prisma, tableName);

  for (const column of requiredColumns) {
    if (!existingColumns.has(column)) {
      throw new Error(`Migration failed to create required column ${tableName}.${column}`);
    }
  }
}

async function migratePostTargetToV2(prisma: PrismaClientLike) {
  const existingColumns = await getTableColumns(prisma, 'PostTarget');
  const hasV2Columns = REQUIRED_POST_TARGET_COLUMNS.every((column) =>
    existingColumns.has(column)
  );

  if (hasV2Columns) {
    await createPostTargetIndexes(prisma);
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "PostTarget_v2" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "postId" INTEGER NOT NULL,
      "accountId" INTEGER NOT NULL,
      "platform" TEXT NOT NULL DEFAULT 'facebook',
      "targetType" TEXT NOT NULL DEFAULT 'legacy_account',
      "pageId" TEXT,
      "pageName" TEXT,
      "sourceAccountName" TEXT,
      "platformPostId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PostTarget_v2_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PostTarget_v2_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "PostTarget_v2" (
      "id",
      "postId",
      "accountId",
      "platform",
      "targetType",
      "pageId",
      "pageName",
      "sourceAccountName",
      "platformPostId",
      "status",
      "errorMessage",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "id",
      "postId",
      "accountId",
      'facebook' AS "platform",
      'legacy_account' AS "targetType",
      NULL AS "pageId",
      NULL AS "pageName",
      NULL AS "sourceAccountName",
      "platformPostId",
      "status",
      "errorMessage",
      "createdAt",
      "updatedAt"
    FROM "PostTarget"
  `);

  await prisma.$executeRawUnsafe('DROP TABLE "PostTarget"');
  await prisma.$executeRawUnsafe('ALTER TABLE "PostTarget_v2" RENAME TO "PostTarget"');

  await createPostTargetIndexes(prisma);
  await ensureRequiredColumns(prisma, 'PostTarget', REQUIRED_POST_TARGET_COLUMNS);
}

async function migratePublishJobToV2(prisma: PrismaClientLike) {
  const existingColumns = await getTableColumns(prisma, 'PublishJob');
  const hasV2Columns = REQUIRED_PUBLISH_JOB_COLUMNS.every((column) =>
    existingColumns.has(column)
  );

  if (hasV2Columns) {
    await createPublishJobIndexes(prisma);
    return;
  }

  await prisma.$executeRawUnsafe(`
    CREATE TABLE "PublishJob_v2" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "postId" INTEGER NOT NULL,
      "accountId" INTEGER NOT NULL,
      "platform" TEXT NOT NULL,
      "pageId" TEXT,
      "pageName" TEXT,
      "sourceAccountName" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "priority" INTEGER NOT NULL DEFAULT 0,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "maxRetries" INTEGER NOT NULL DEFAULT 3,
      "nextRetryAt" DATETIME,
      "startedAt" DATETIME,
      "completedAt" DATETIME,
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PublishJob_v2_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PublishJob_v2_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "PublishJob_v2" (
      "id",
      "postId",
      "accountId",
      "platform",
      "pageId",
      "pageName",
      "sourceAccountName",
      "status",
      "priority",
      "retryCount",
      "maxRetries",
      "nextRetryAt",
      "startedAt",
      "completedAt",
      "errorCode",
      "errorMessage",
      "createdAt",
      "updatedAt"
    )
    SELECT
      "id",
      "postId",
      "accountId",
      "platform",
      NULL AS "pageId",
      NULL AS "pageName",
      NULL AS "sourceAccountName",
      "status",
      "priority",
      "retryCount",
      "maxRetries",
      "nextRetryAt",
      "startedAt",
      "completedAt",
      "errorCode",
      "errorMessage",
      "createdAt",
      "updatedAt"
    FROM "PublishJob"
  `);

  await prisma.$executeRawUnsafe('DROP TABLE "PublishJob"');
  await prisma.$executeRawUnsafe('ALTER TABLE "PublishJob_v2" RENAME TO "PublishJob"');

  await createPublishJobIndexes(prisma);
  await ensureRequiredColumns(prisma, 'PublishJob', REQUIRED_PUBLISH_JOB_COLUMNS);
}

async function runMigrationV1ToV2(prisma: PrismaClientLike) {
  await prisma.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
  await prisma.$executeRawUnsafe('BEGIN IMMEDIATE TRANSACTION');

  try {
    await migratePostTargetToV2(prisma);
    await migratePublishJobToV2(prisma);

    const foreignKeyCheckRows = await prisma.$queryRawUnsafe<unknown[]>('PRAGMA foreign_key_check');
    if (Array.isArray(foreignKeyCheckRows) && foreignKeyCheckRows.length > 0) {
      throw new Error(`Foreign key check failed after migration: ${JSON.stringify(foreignKeyCheckRows)}`);
    }

    await prisma.$executeRawUnsafe(`PRAGMA user_version = ${CURRENT_DATABASE_SCHEMA_VERSION}`);
    await prisma.$executeRawUnsafe('COMMIT');
  } catch (error) {
    await prisma.$executeRawUnsafe('ROLLBACK');
    throw error;
  } finally {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
  }
}

export async function runMigrations(options: {
  databasePath: string;
  currentVersion: number;
  prisma: PrismaClientLike;
}) {
  const { databasePath, currentVersion, prisma } = options;

  if (currentVersion > CURRENT_DATABASE_SCHEMA_VERSION) {
    throw new Error(
      `Database schema version ${currentVersion} is newer than this app supports (${CURRENT_DATABASE_SCHEMA_VERSION}).`
    );
  }

  if (currentVersion === CURRENT_DATABASE_SCHEMA_VERSION) {
    return {
      migrated: false,
      backupPath: null,
      currentVersion,
      targetVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    };
  }

  const backupPath = await createTimestampedBackup(databasePath);

  if (currentVersion === 0) {
    await prisma.$executeRawUnsafe(
      `PRAGMA user_version = ${CURRENT_DATABASE_SCHEMA_VERSION}`
    );

    return {
      migrated: true,
      backupPath,
      currentVersion,
      targetVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    };
  }

  if (currentVersion === 1) {
    await runMigrationV1ToV2(prisma);

    return {
      migrated: true,
      backupPath,
      currentVersion,
      targetVersion: CURRENT_DATABASE_SCHEMA_VERSION,
    };
  }

  throw new Error(
    `No migration path is defined from schema version ${currentVersion} to ${CURRENT_DATABASE_SCHEMA_VERSION}.`
  );
}