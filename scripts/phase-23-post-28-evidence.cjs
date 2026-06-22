const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({ log: ['error'] });

function parseJson(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return {
      raw: String(value).slice(0, 500),
      parseError: true,
    };
  }
}

function safeSuffix(value) {
  if (!value) {
    return null;
  }

  const stringValue = String(value);
  return `••${stringValue.slice(-6)}`;
}

async function main() {
  const post = await prisma.post.findUnique({
    where: { id: 28 },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      publishedAt: true,
      scheduledAt: true,
      mediaType: true,
      mediaFileName: true,
      mediaFileSize: true,
      mediaMimeType: true,
      mediaExtension: true,
      mediaDurationMs: true,
    },
  });

  const job = await prisma.publishJob.findUnique({
    where: { id: 21 },
    select: {
      id: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
    },
  });

  const attempts = await prisma.publishAttempt.findMany({
    where: {
      job: {
        postId: 28,
      },
    },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      jobId: true,
      attemptNumber: true,
      status: true,
      errorCode: true,
      errorMessage: true,
      responseData: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const targets = await prisma.postTarget.findMany({
    where: { postId: 28 },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      status: true,
      platformPostId: true,
      account: {
        select: {
          platform: true,
          accountId: true,
          accountName: true,
        },
      },
    },
  });

  const pendingJobCount = await prisma.publishJob.count({
    where: {
      postId: 28,
      status: 'pending',
    },
  });

  const activeJobCount = await prisma.publishJob.count({
    where: {
      postId: 28,
      status: {
        in: ['pending', 'processing'],
      },
    },
  });

  let endpointCategory = null;
  let providerReached = false;
  let hasProviderVideoAcceptance = false;
  let safeFailureMeta = null;
  let needsVerificationReason = null;

  const normalizedAttempts = attempts.map((attempt) => {
    const responseData = parseJson(attempt.responseData);

    if (responseData && typeof responseData === 'object') {
      endpointCategory = endpointCategory || responseData.endpointCategory || null;
      providerReached = providerReached || Boolean(responseData.providerReached);
      hasProviderVideoAcceptance =
        hasProviderVideoAcceptance ||
        Boolean(responseData.hasProviderVideoAcceptance);
      safeFailureMeta =
        safeFailureMeta ||
        (responseData.safeFailureMeta &&
        typeof responseData.safeFailureMeta === 'object'
          ? responseData.safeFailureMeta
          : null);
      needsVerificationReason =
        needsVerificationReason || responseData.needsVerificationReason || null;
    }

    return {
      ...attempt,
      responseData,
    };
  });

  const result = {
    post,
    effectiveStatus: post?.status ?? null,
    job: job || null,
    attempts: normalizedAttempts,
    targets: targets.map((target) => ({
      id: target.id,
      status: target.status,
      platform: target.account.platform,
      accountName: target.account.accountName,
      accountIdPrefix: target.account.accountId
        ? String(target.account.accountId).slice(0, 4)
        : null,
      platformPostIdSuffix: safeSuffix(target.platformPostId),
    })),
    derived: {
      attemptCount: normalizedAttempts.length,
      attemptIds: normalizedAttempts.map((attempt) => attempt.id),
      endpointCategory,
      providerReached,
      hasProviderVideoAcceptance,
      safeFailureMeta,
      needsVerificationReason,
      pendingJobCount,
      activeJobCount,
      duplicateActiveJobCount: Math.max(0, activeJobCount - 1),
    },
  };

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });