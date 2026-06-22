const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SIM_ACCOUNT_PREFIX = 'mock_facebook_runtime_';

function getEncryptionKey() {
  const envKey = process.env.ENCRYPTION_KEY;

  if (envKey) {
    return crypto.pbkdf2Sync(
      envKey,
      'social-auto-poster-salt',
      100000,
      KEY_LENGTH,
      'sha256'
    );
  }

  return crypto.pbkdf2Sync(
    'dev-encryption-key-change-in-production',
    'social-auto-poster-salt',
    100000,
    KEY_LENGTH,
    'sha256'
  );
}

function encrypt(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

async function ensureSimulationSettings() {
  const schedulerSettings = {
    autoPostingEnabled: true,
    interval: 1,
    maxRetries: 3,
    retryDelay: 1,
    simulationMode: true,
    notificationsEnabled: true,
  };

  await prisma.appSetting.upsert({
    where: { key: 'scheduler_settings' },
    update: {
      value: JSON.stringify(schedulerSettings),
      description: 'Runtime simulation scheduler settings',
      updatedAt: new Date(),
    },
    create: {
      key: 'scheduler_settings',
      value: JSON.stringify(schedulerSettings),
      description: 'Runtime simulation scheduler settings',
    },
  });

  return schedulerSettings;
}

async function ensureSimulationAccount(nameSuffix) {
  const accountId = `${SIM_ACCOUNT_PREFIX}${nameSuffix}`;
  const encryptedAccessToken = encrypt(`mock_runtime_access_token_${nameSuffix}`);
  const encryptedRefreshToken = encrypt(`mock_runtime_refresh_token_${nameSuffix}`);

  const existing = await prisma.account.findFirst({
    where: {
      accountId,
      platform: 'facebook',
    },
  });

  if (existing) {
    return prisma.account.update({
      where: { id: existing.id },
      data: {
        accountName: `Simulation Facebook Account ${nameSuffix}`,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });
  }

  return prisma.account.create({
    data: {
      platform: 'facebook',
      accountId,
      accountName: `Simulation Facebook Account ${nameSuffix}`,
      avatarUrl: null,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
    },
  });
}

async function createScheduledPost({ title, content, scheduledAt, targetAccountIds }) {
  return prisma.post.create({
    data: {
      title,
      content,
      hashtags: '#runtime #simulation #phase5',
      mediaType: 'none',
      status: 'scheduled',
      scheduledAt,
      postTargets: {
        create: targetAccountIds.map((accountId) => ({
          accountId,
          status: 'pending',
        })),
      },
    },
    include: {
      postTargets: true,
    },
  });
}

async function createRestartRecoveryPost(accountId) {
  const post = await prisma.post.create({
    data: {
      title: 'Runtime Simulation Restart Recovery',
      content: 'Restart recovery verification post',
      hashtags: '#restart #recovery',
      mediaType: 'none',
      status: 'posting',
      scheduledAt: new Date(Date.now() - 2 * 60 * 1000),
      lockedAt: new Date(Date.now() - 10 * 60 * 1000),
      lockedBy: 'runtime-simulation-seed',
      postTargets: {
        create: [
          {
            accountId,
            status: 'pending',
          },
        ],
      },
    },
  });

  await prisma.publishJob.create({
    data: {
      postId: post.id,
      accountId,
      platform: 'facebook',
      status: 'processing',
      retryCount: 0,
      maxRetries: 3,
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      errorMessage: null,
    },
  });

  return post;
}

async function main() {
  const settings = await ensureSimulationSettings();

  const primaryAccount = await ensureSimulationAccount('primary');
  const secondaryAccount = await ensureSimulationAccount('secondary');

  const now = Date.now();

  const successPost = await createScheduledPost({
    title: 'Runtime Simulation Success Path',
    content: 'Simulation success lifecycle validation',
    scheduledAt: new Date(now - 5000),
    targetAccountIds: [primaryAccount.id],
  });

  const retryPost = await createScheduledPost({
    title: 'Runtime Simulation Retry Path',
    content: 'Simulation retry lifecycle validation [simulate:retry_once]',
    scheduledAt: new Date(now - 4000),
    targetAccountIds: [primaryAccount.id],
  });

  const failedPost = await createScheduledPost({
    title: 'Runtime Simulation Permanent Failure Path',
    content: 'Simulation permanent failure lifecycle validation [simulate:always_fail]',
    scheduledAt: new Date(now - 3000),
    targetAccountIds: [primaryAccount.id],
  });

  const partialFailurePost = await createScheduledPost({
    title: 'Runtime Simulation Partial Failure Path',
    content: 'Simulation mixed target lifecycle validation [simulate:partial_failure]',
    scheduledAt: new Date(now - 2000),
    targetAccountIds: [primaryAccount.id, secondaryAccount.id],
  });

  const restartRecoveryPost = await createRestartRecoveryPost(primaryAccount.id);

  const existingUnreadNotifications = await prisma.notification.count({
    where: { isRead: false },
  });

  const existingSchedulerEvents = await prisma.schedulerEvent.count();

  console.log(
    JSON.stringify(
      {
        seededAt: new Date().toISOString(),
        schedulerSettings: settings,
        accounts: [
          {
            id: primaryAccount.id,
            accountId: primaryAccount.accountId,
            accountName: primaryAccount.accountName,
          },
          {
            id: secondaryAccount.id,
            accountId: secondaryAccount.accountId,
            accountName: secondaryAccount.accountName,
          },
        ],
        scenarios: [
          {
            type: 'success',
            postId: successPost.id,
            expectedLifecycle: ['scheduled', 'queued', 'posting', 'published'],
          },
          {
            type: 'retry_once_then_success',
            postId: retryPost.id,
            expectedLifecycle: ['scheduled', 'queued', 'posting', 'published'],
          },
          {
            type: 'permanent_failure',
            postId: failedPost.id,
            expectedLifecycle: ['scheduled', 'queued', 'posting', 'failed'],
          },
          {
            type: 'partial_failure',
            postId: partialFailurePost.id,
            expectedLifecycle: ['scheduled', 'queued', 'posting', 'partially_failed'],
          },
          {
            type: 'restart_recovery',
            postId: restartRecoveryPost.id,
            expectedLifecycle: ['posting', 'scheduled', 'queued', 'posting', 'published'],
          },
        ],
        preRunSnapshot: {
          unreadNotifications: existingUnreadNotifications,
          schedulerEventCount: existingSchedulerEvents,
        },
        instructions: [
          '1. Start the app with npm run dev.',
          '2. Wait for scheduler and queue processing to complete.',
          '3. Use node scripts/runtime-db-check.cjs to inspect final states.',
          '4. Verify diagnostics page shows queue, retries, failures, and recovery activity.',
        ],
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });