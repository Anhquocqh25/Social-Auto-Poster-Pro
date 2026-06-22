const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

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

async function ensureSimulationAccount() {
  const existing = await prisma.account.findFirst({
    where: {
      platform: 'facebook',
      accountId: {
        startsWith: 'mock_facebook_',
      },
    },
  });

  if (existing) {
    return existing;
  }

  const now = Date.now();
  return prisma.account.create({
    data: {
      platform: 'facebook',
      accountId: `mock_facebook_${now}`,
      accountName: `Simulation Facebook Account ${new Date(now).toLocaleTimeString()}`,
      avatarUrl: null,
      accessToken: encrypt(`mock_access_token_${now}`),
      refreshToken: encrypt(`mock_refresh_token_${now}`),
      tokenExpiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
  });
}

async function createPostWithTarget(accountId, status, scheduledAt, lockedAt = null, lockedBy = null) {
  return prisma.post.create({
    data: {
      title: `Recovery Test ${status}`,
      content: `Recovery test seed for status ${status}`,
      mediaType: 'none',
      status,
      scheduledAt,
      lockedAt,
      lockedBy,
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
}

async function main() {
  const account = await ensureSimulationAccount();
  const now = new Date();
  const staleLockTime = new Date(Date.now() - 10 * 60 * 1000);

  const scheduledFuture = await createPostWithTarget(
    account.id,
    'scheduled',
    new Date(Date.now() + 5 * 60 * 1000)
  );

  const scheduledDue = await createPostWithTarget(
    account.id,
    'scheduled',
    new Date(Date.now() - 60 * 1000)
  );

  const queuedInterrupted = await createPostWithTarget(
    account.id,
    'queued',
    new Date(Date.now() - 2 * 60 * 1000),
    staleLockTime,
    'scheduler-stale-test'
  );

  const postingInterrupted = await createPostWithTarget(
    account.id,
    'posting',
    new Date(Date.now() - 2 * 60 * 1000),
    staleLockTime,
    'queue-stale-test'
  );

  console.log(
    JSON.stringify(
      {
        accountId: account.id,
        createdPosts: {
          scheduledFuture: scheduledFuture.id,
          scheduledDue: scheduledDue.id,
          queuedInterrupted: queuedInterrupted.id,
          postingInterrupted: postingInterrupted.id,
        },
        instructions: [
          '1. Start the app with npm run dev or npm run electron:dev',
          '2. Restart the app after seeding if needed',
          '3. Verify queued/posting posts are recovered back to scheduled or processed safely',
          '4. Verify stale locks are cleared',
          '5. Verify due scheduled post is queued once without duplicate jobs',
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