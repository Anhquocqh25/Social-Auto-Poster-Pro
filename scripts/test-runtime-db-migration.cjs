const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { spawnSync } = require('child_process');

const projectRoot = process.cwd();

function exec(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...env,
    },
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(' ')}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }

  return result.stdout;
}

function transpileTypeScriptModule(relativePath, overrides = {}) {
  const absolutePath = path.join(projectRoot, relativePath);
  const source = fs.readFileSync(absolutePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });

  const module = { exports: {} };
  const localRequire = (request) => {
    if (Object.prototype.hasOwnProperty.call(overrides, request)) {
      return overrides[request];
    }

    if (request.startsWith('./') || request.startsWith('../')) {
      const resolved = path.join(path.dirname(absolutePath), request);
      const relativeToRoot = path.relative(projectRoot, resolved).replace(/\\/g, '/');
      const tsPath = relativeToRoot.endsWith('.ts') ? relativeToRoot : `${relativeToRoot}.ts`;

      if (fs.existsSync(path.join(projectRoot, tsPath))) {
        return transpileTypeScriptModule(tsPath, overrides);
      }
    }

    return require(request);
  };

  const context = vm.createContext({
    module,
    exports: module.exports,
    require: localRequire,
    console,
    process,
    __dirname: path.dirname(absolutePath),
    __filename: absolutePath,
    Buffer,
    setTimeout,
    clearTimeout,
  });

  new vm.Script(transpiled.outputText, { filename: absolutePath }).runInContext(context);
  return module.exports;
}

async function createPrismaClient(databasePath) {
  process.env.DATABASE_URL = `file:${databasePath}`;
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
  await prisma.$connect();
  return prisma;
}

async function getUserVersion(prisma) {
  const rows = await prisma.$queryRawUnsafe('PRAGMA user_version');
  const firstRow = Array.isArray(rows) ? rows[0] : rows;
  return Number(firstRow?.user_version ?? firstRow?.userVersion ?? Object.values(firstRow ?? {})[0] ?? 0);
}

async function getColumnNames(prisma, tableName) {
  const rows = await prisma.$queryRawUnsafe(`PRAGMA table_info('${tableName}')`);
  return rows.map((row) => row.name).sort();
}

async function getForeignKeyCheckRows(prisma) {
  return await prisma.$queryRawUnsafe('PRAGMA foreign_key_check');
}

function buildV1FixtureSql() {
  return `
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;

    CREATE TABLE "Account" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "platform" TEXT NOT NULL,
      "accountName" TEXT NOT NULL,
      "accountId" TEXT NOT NULL,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "tokenExpiresAt" DATETIME,
      "isActive" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE UNIQUE INDEX "Account_accountId_key" ON "Account"("accountId");
    CREATE INDEX "Account_platform_idx" ON "Account"("platform");
    CREATE INDEX "Account_accountId_idx" ON "Account"("accountId");

    CREATE TABLE "Post" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "title" TEXT,
      "content" TEXT NOT NULL,
      "hashtags" TEXT,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "scheduledAt" DATETIME,
      "publishedAt" DATETIME,
      "errorMessage" TEXT,
      "retryCount" INTEGER NOT NULL DEFAULT 0,
      "lastRetryAt" DATETIME,
      "lockedAt" DATETIME,
      "lockedBy" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
    CREATE INDEX "Post_status_idx" ON "Post"("status");
    CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");
    CREATE INDEX "Post_lockedAt_idx" ON "Post"("lockedAt");

    CREATE TABLE "PostTarget" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "postId" INTEGER NOT NULL,
      "accountId" INTEGER NOT NULL,
      "platformPostId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "PostTarget_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PostTarget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX "PostTarget_postId_accountId_key" ON "PostTarget"("postId", "accountId");
    CREATE INDEX "PostTarget_status_idx" ON "PostTarget"("status");

    CREATE TABLE "PublishJob" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "postId" INTEGER NOT NULL,
      "accountId" INTEGER NOT NULL,
      "platform" TEXT NOT NULL,
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
      CONSTRAINT "PublishJob_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "PublishJob_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE UNIQUE INDEX "PublishJob_postId_accountId_key" ON "PublishJob"("postId", "accountId");
    CREATE INDEX "PublishJob_status_idx" ON "PublishJob"("status");
    CREATE INDEX "PublishJob_nextRetryAt_idx" ON "PublishJob"("nextRetryAt");
    CREATE INDEX "PublishJob_postId_idx" ON "PublishJob"("postId");
    CREATE INDEX "PublishJob_accountId_idx" ON "PublishJob"("accountId");

    CREATE TABLE "PublishAttempt" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "jobId" INTEGER NOT NULL,
      "attemptNumber" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "finishedAt" DATETIME,
      "errorCode" TEXT,
      "errorMessage" TEXT,
      "responseData" TEXT,
      CONSTRAINT "PublishAttempt_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "PublishJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
    CREATE INDEX "PublishAttempt_jobId_idx" ON "PublishAttempt"("jobId");
    CREATE INDEX "PublishAttempt_status_idx" ON "PublishAttempt"("status");

    INSERT INTO "Account" ("id", "platform", "accountName", "accountId", "isActive", "createdAt", "updatedAt")
    VALUES
      (1, 'facebook', 'Account One', 'acc_1', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      (2, 'facebook', 'Account Two', 'acc_2', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

    INSERT INTO "Post" ("id", "title", "content", "status", "createdAt", "updatedAt")
    VALUES
      (100, 'Fixture Post', 'Fixture Content', 'queued', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

    INSERT INTO "PostTarget" ("id", "postId", "accountId", "platformPostId", "status", "errorMessage", "createdAt", "updatedAt")
    VALUES
      (1000, 100, 1, NULL, 'pending', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      (1001, 100, 2, NULL, 'pending', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

    INSERT INTO "PublishJob" ("id", "postId", "accountId", "platform", "status", "priority", "retryCount", "maxRetries", "createdAt", "updatedAt")
    VALUES
      (2000, 100, 1, 'facebook', 'pending', 0, 0, 3, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
      (2001, 100, 2, 'facebook', 'pending', 0, 0, 3, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

    INSERT INTO "PublishAttempt" ("id", "jobId", "attemptNumber", "status", "startedAt", "finishedAt", "responseData")
    VALUES
      (3000, 2000, 1, 'success', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z', '{"ok":true}');

    PRAGMA user_version = 1;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `;
}

async function seedAdditionalPageLevelRows(prisma) {
  await prisma.$executeRawUnsafe(`
    INSERT INTO "PostTarget" (
      "postId", "accountId", "platform", "targetType", "pageId", "pageName", "sourceAccountName",
      "platformPostId", "status", "errorMessage", "createdAt", "updatedAt"
    ) VALUES
      (100, 1, 'facebook', 'page', 'PAGE_A', 'ROUTING_TEST_PAGE_A', 'Account One', NULL, 'pending', NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
      (100, 1, 'facebook', 'page', 'PAGE_B', 'ROUTING_TEST_PAGE_B', 'Account One', NULL, 'pending', NULL, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "PublishJob" (
      "postId", "accountId", "platform", "pageId", "pageName", "sourceAccountName",
      "status", "priority", "retryCount", "maxRetries", "createdAt", "updatedAt"
    ) VALUES
      (100, 1, 'facebook', 'PAGE_A', 'ROUTING_TEST_PAGE_A', 'Account One', 'pending', 0, 0, 3, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
      (100, 1, 'facebook', 'PAGE_B', 'ROUTING_TEST_PAGE_B', 'Account One', 'pending', 0, 0, 3, '2026-01-02T00:00:00.000Z', '2026-01-02T00:00:00.000Z')
  `);
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sap-migration-test-'));
  const userDataDir = path.join(tempRoot, 'userData');
  const databasePath = path.join(tempRoot, 'fixture-v1.db');

  fs.mkdirSync(userDataDir, { recursive: true });

  const fixtureSqlPath = path.join(tempRoot, 'fixture-v1.sql');
  fs.writeFileSync(fixtureSqlPath, buildV1FixtureSql());
  exec(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'execute', '--url', `file:${databasePath}`, '--file', fixtureSqlPath],
    {}
  );

  const prisma = await createPrismaClient(databasePath);

  const electronMock = {
    app: {
      getPath(name) {
        if (name === 'userData') {
          return userDataDir;
        }
        throw new Error(`Unexpected app.getPath request: ${name}`);
      },
    },
  };

  const { runMigrations } = transpileTypeScriptModule('electron/database/runMigrations.ts', {
    electron: electronMock,
  });

  try {
    const beforeVersion = await getUserVersion(prisma);
    assert.strictEqual(beforeVersion, 1, 'Fixture must start at schema version 1');

    const migrationResult = await runMigrations({
      databasePath,
      currentVersion: beforeVersion,
      prisma,
    });

    assert.strictEqual(migrationResult.migrated, true, 'Version 1 fixture must migrate');
    assert.strictEqual(migrationResult.currentVersion, 1, 'Reported source version must be 1');
    assert.strictEqual(migrationResult.targetVersion, 2, 'Reported target version must be 2');
    assert.ok(migrationResult.backupPath, 'Migration must create a backup path');
    assert.ok(fs.existsSync(migrationResult.backupPath), 'Migration backup file must exist');

    const afterVersion = await getUserVersion(prisma);
    assert.strictEqual(afterVersion, 2, 'Migrated fixture must reach schema version 2');

    assert.strictEqual(await prisma.account.count(), 2, 'Existing Account rows must be preserved');
    assert.strictEqual(await prisma.post.count(), 1, 'Existing Post rows must be preserved');
    assert.strictEqual(await prisma.postTarget.count(), 2, 'Existing legacy PostTarget rows must be preserved');
    assert.strictEqual(await prisma.publishJob.count(), 2, 'Existing legacy PublishJob rows must be preserved');
    assert.strictEqual(await prisma.publishAttempt.count(), 1, 'Existing PublishAttempt rows must be preserved');

    const migratedTargets = await prisma.postTarget.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        platform: true,
        targetType: true,
        pageId: true,
        pageName: true,
        sourceAccountName: true,
      },
    });

    assert.deepStrictEqual(
      migratedTargets,
      [
        {
          id: 1000,
          platform: 'facebook',
          targetType: 'legacy_account',
          pageId: null,
          pageName: null,
          sourceAccountName: null,
        },
        {
          id: 1001,
          platform: 'facebook',
          targetType: 'legacy_account',
          pageId: null,
          pageName: null,
          sourceAccountName: null,
        },
      ],
      'Legacy PostTarget rows must receive default/NULL page-routing values'
    );

    const migratedJobs = await prisma.publishJob.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        sourceAccountName: true,
      },
    });

    assert.deepStrictEqual(
      migratedJobs,
      [
        { id: 2000, pageId: null, pageName: null, sourceAccountName: null },
        { id: 2001, pageId: null, pageName: null, sourceAccountName: null },
      ],
      'Legacy PublishJob rows must receive NULL page-routing values'
    );

    assert.deepStrictEqual(
      await getForeignKeyCheckRows(prisma),
      [],
      'Foreign-key check must pass after migration'
    );

    const postTargetColumns = await getColumnNames(prisma, 'PostTarget');
    const publishJobColumns = await getColumnNames(prisma, 'PublishJob');

    for (const column of ['platform', 'targetType', 'pageId', 'pageName', 'sourceAccountName']) {
      assert.ok(postTargetColumns.includes(column), `PostTarget must contain ${column}`);
    }

    for (const column of ['pageId', 'pageName', 'sourceAccountName']) {
      assert.ok(publishJobColumns.includes(column), `PublishJob must contain ${column}`);
    }

    await seedAdditionalPageLevelRows(prisma);

    const sameAccountTargets = await prisma.postTarget.findMany({
      where: { postId: 100, accountId: 1, pageId: { not: null } },
      orderBy: { pageId: 'asc' },
      select: { pageId: true, pageName: true },
    });

    assert.deepStrictEqual(
      sameAccountTargets,
      [
        { pageId: 'PAGE_A', pageName: 'ROUTING_TEST_PAGE_A' },
        { pageId: 'PAGE_B', pageName: 'ROUTING_TEST_PAGE_B' },
      ],
      'Page A and Page B must coexist under the same post/account after migration'
    );

    let duplicateRejected = false;
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO "PostTarget" (
          "postId", "accountId", "platform", "targetType", "pageId", "pageName", "sourceAccountName",
          "platformPostId", "status", "errorMessage", "createdAt", "updatedAt"
        ) VALUES
          (100, 1, 'facebook', 'page', 'PAGE_A', 'ROUTING_TEST_PAGE_A', 'Account One', NULL, 'pending', NULL, '2026-01-03T00:00:00.000Z', '2026-01-03T00:00:00.000Z')
      `);
    } catch (error) {
      duplicateRejected = true;
    }

    assert.strictEqual(
      duplicateRejected,
      true,
      'Duplicate identical page target must be rejected by the rebuilt unique index'
    );

    const rerunResult = await runMigrations({
      databasePath,
      currentVersion: 2,
      prisma,
    });

    assert.strictEqual(rerunResult.migrated, false, 'Rerun must not migrate schema version 2');
    assert.strictEqual(rerunResult.backupPath, null, 'Rerun must not create a backup');
    assert.strictEqual(rerunResult.currentVersion, 2, 'Rerun must report currentVersion 2');
    assert.strictEqual(rerunResult.targetVersion, 2, 'Rerun must report targetVersion 2');

    console.log('runtime-db-migration: PASS');
  } finally {
    await prisma.$disconnect();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error('runtime-db-migration: FAIL');
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});