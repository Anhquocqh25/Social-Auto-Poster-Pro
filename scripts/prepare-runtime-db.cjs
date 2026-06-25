const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REQUIRED_TABLES = [
  'Account',
  'Post',
  'PostTarget',
  'MediaLibrary',
  'Log',
  'Setting',
  'OAuthSession',
  'PlatformToken',
  'PlatformSetting',
  'PublishJob',
  'PublishAttempt',
  'SchedulerEvent',
  'Notification',
  'AppSetting',
];

const REQUIRED_ZERO_DATA_TABLES = [
  'Account',
  'Post',
  'OAuthSession',
  'PlatformToken',
  'PublishJob',
  'Notification',
];

const REQUIRED_POST_TARGET_COLUMNS = [
  'id',
  'postId',
  'accountId',
  'platform',
  'targetType',
  'pageId',
  'pageName',
  'sourceAccountName',
  'platformPostId',
  'status',
  'errorMessage',
  'createdAt',
  'updatedAt',
];

const REQUIRED_PUBLISH_JOB_COLUMNS = [
  'id',
  'postId',
  'accountId',
  'platform',
  'pageId',
  'pageName',
  'sourceAccountName',
  'status',
  'priority',
  'retryCount',
  'maxRetries',
  'nextRetryAt',
  'startedAt',
  'completedAt',
  'errorCode',
  'errorMessage',
  'createdAt',
  'updatedAt',
];

const CURRENT_DATABASE_SCHEMA_VERSION = 2;

const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'build-resources', 'runtime-db');
const runtimeTemplatePath = path.join(outputDir, 'runtime-template.db');

function exec(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      ...env,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if ((result.status ?? 1) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function getTableColumnNames(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${tableName}')`);
  return new Set(rows.map((row) => row.name));
}

async function assertRequiredColumns(prisma, tableName, requiredColumns) {
  const columns = await getTableColumnNames(prisma, tableName);

  for (const column of requiredColumns) {
    if (!columns.has(column)) {
      throw new Error(`Required column missing from runtime template: ${tableName}.${column}`);
    }
  }
}

async function verifyRuntimeTemplate(databasePath) {
  process.env.DATABASE_URL = `file:${databasePath}`;

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    const sqliteMasterRows = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC"
    );
    const tableNames = new Set(sqliteMasterRows.map((row) => row.name));

    for (const table of REQUIRED_TABLES) {
      if (!tableNames.has(table)) {
        throw new Error(`Required table missing from runtime template: ${table}`);
      }
    }

    await assertRequiredColumns(prisma, 'PostTarget', REQUIRED_POST_TARGET_COLUMNS);
    await assertRequiredColumns(prisma, 'PublishJob', REQUIRED_PUBLISH_JOB_COLUMNS);

    const zeroDataCounts = {
      Account: await prisma.account.count(),
      Post: await prisma.post.count(),
      OAuthSession: await prisma.oAuthSession.count(),
      PlatformToken: await prisma.platformToken.count(),
      PublishJob: await prisma.publishJob.count(),
      Notification: await prisma.notification.count(),
    };

    for (const table of REQUIRED_ZERO_DATA_TABLES) {
      const count = Number(zeroDataCounts[table] ?? 0);
      if (count !== 0) {
        throw new Error(`Runtime template table ${table} must be empty, found ${count} row(s)`);
      }
    }

    await prisma.$executeRawUnsafe(
      `PRAGMA user_version = ${CURRENT_DATABASE_SCHEMA_VERSION}`
    );

    const versionRow = await prisma.$queryRawUnsafe('PRAGMA user_version');
    const firstRow = Array.isArray(versionRow) ? versionRow[0] : versionRow;
    const userVersion = Number(
      firstRow?.user_version ??
        firstRow?.userVersion ??
        Object.values(firstRow ?? {})[0] ??
        0
    );

    if (userVersion !== CURRENT_DATABASE_SCHEMA_VERSION) {
      throw new Error(
        `Runtime template PRAGMA user_version mismatch: expected ${CURRENT_DATABASE_SCHEMA_VERSION}, got ${userVersion}`
      );
    }

    return {
      zeroDataCounts,
      userVersion,
      postTargetColumns: Array.from(await getTableColumnNames(prisma, 'PostTarget')).sort(),
      publishJobColumns: Array.from(await getTableColumnNames(prisma, 'PublishJob')).sort(),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  if (fs.existsSync(runtimeTemplatePath)) {
    fs.unlinkSync(runtimeTemplatePath);
  }

  exec(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'push', '--skip-generate'],
    {
      DATABASE_URL: `file:${runtimeTemplatePath}`,
    }
  );

  const verification = await verifyRuntimeTemplate(runtimeTemplatePath);

  console.log(
    JSON.stringify(
      {
        runtimeTemplatePath,
        requiredTables: REQUIRED_TABLES,
        zeroDataTables: REQUIRED_ZERO_DATA_TABLES,
        zeroDataCounts: verification.zeroDataCounts,
        schemaVersion: verification.userVersion,
        postTargetColumns: verification.postTargetColumns,
        publishJobColumns: verification.publishJobColumns,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('[prepare-runtime-db] Failed:', error.message);
  process.exit(1);
});