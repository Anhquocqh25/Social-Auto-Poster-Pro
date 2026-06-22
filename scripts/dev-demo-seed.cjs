const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const SIM_ACCOUNT_PREFIX = 'mock_facebook_demo_';

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

async function ensureSchedulerSettings() {
  const schedulerSettings = {
    autoPostingEnabled: true,
    interval: 1,
    maxRetryAttempts: 3,
    baseRetryDelay: 1,
    notificationEnabled: true,
    logRetentionDays: 30,
    simulationMode: true,
  };

  await prisma.appSetting.upsert({
    where: { key: 'scheduler_settings' },
    update: {
      value: JSON.stringify(schedulerSettings),
      description: 'Demo scheduler settings',
      updatedAt: new Date(),
    },
    create: {
      key: 'scheduler_settings',
      value: JSON.stringify(schedulerSettings),
      description: 'Demo scheduler settings',
    },
  });

  return schedulerSettings;
}

async function createSimulationAccount(nameSuffix) {
  return prisma.account.create({
    data: {
      platform: 'facebook',
      accountId: `${SIM_ACCOUNT_PREFIX}${nameSuffix}`,
      accountName: `Simulation Facebook Account ${nameSuffix}`,
      avatarUrl: null,
      accessToken: encrypt(`demo_access_token_${nameSuffix}`),
      refreshToken: encrypt(`demo_refresh_token_${nameSuffix}`),
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'active',
    },
  });
}

async function createPost({ title, content, status, scheduledAt, accountIds, lockedAt = null, lockedBy = null }) {
  return prisma.post.create({
    data: {
      title,
      content,
      hashtags: '#demo #simulation #phase59',
      mediaType: 'none',
      status,
      scheduledAt,
      lockedAt,
      lockedBy,
      postTargets: {
        create: accountIds.map((accountId) => ({
          accountId,
          status: 'pending',
        })),
      },
    },
  });
}

async function createRecoverySeed(accountId) {
  const post = await createPost({
    title: 'Demo Restart Recovery',
    content: 'Demo restart recovery verification post',
    status: 'posting',
    scheduledAt: new Date(Date.now() - 2 * 60 * 1000),
    accountIds: [accountId],
    lockedAt: new Date(Date.now() - 10 * 60 * 1000),
    lockedBy: 'demo-recovery-seed',
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
  await ensureSchedulerSettings();

  const primaryAccount = await createSimulationAccount('primary');
  const secondaryAccount = await createSimulationAccount('secondary');

  const now = Date.now();

  const successPost = await createPost({
    title: 'Demo Success Publish',
    content: 'Demo success lifecycle validation',
    status: 'scheduled',
    scheduledAt: new Date(now - 5000),
    accountIds: [primaryAccount.id],
  });

  const retryPost = await createPost({
    title: 'Demo Retry Publish',
    content: 'Demo retry lifecycle validation [simulate:retry_once]',
    status: 'scheduled',
    scheduledAt: new Date(now - 4000),
    accountIds: [primaryAccount.id],
  });

  const failedPost = await createPost({
    title: 'Demo Permanent Failure',
    content: 'Demo permanent failure validation [simulate:always_fail]',
    status: 'scheduled',
    scheduledAt: new Date(now - 3000),
    accountIds: [primaryAccount.id],
  });

  const partialFailurePost = await createPost({
    title: 'Demo Partial Failure',
    content: 'Demo partial failure validation [simulate:partial_failure]',
    status: 'scheduled',
    scheduledAt: new Date(now - 2000),
    accountIds: [primaryAccount.id, secondaryAccount.id],
  });

  const recoveryPost = await createRecoverySeed(primaryAccount.id);

  console.log(
    JSON.stringify(
      {
        seededAt: new Date().toISOString(),
        accounts: {
          primary: { id: primaryAccount.id, accountId: primaryAccount.accountId },
          secondary: { id: secondaryAccount.id, accountId: secondaryAccount.accountId },
        },
        posts: {
          successPostId: successPost.id,
          retryPostId: retryPost.id,
          failedPostId: failedPost.id,
          partialFailurePostId: partialFailurePost.id,
          recoveryPostId: recoveryPost.id,
        },
        instructions: [
          '1. Start the app with npm run dev.',
          '2. Open Accounts/Posts/Diagnostics/Notifications routes as needed.',
          '3. Wait for the success, retry, failure, and partial-failure posts to process.',
          '4. For restart recovery, stop and relaunch the app once after seeding.',
          '5. Use node scripts/runtime-db-check.cjs to verify final statuses.',
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