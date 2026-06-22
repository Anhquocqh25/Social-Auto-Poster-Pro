import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

function parsePostIds(argv) {
  const ids = argv
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(ids));
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function safePageName(value) {
  if (!hasText(value)) {
    return null;
  }

  return value.trim();
}

function safePlatformPostIdSuffix(value) {
  if (!hasText(value)) {
    return null;
  }

  const normalized = value.trim();
  if (normalized.startsWith('fb_sim_')) {
    return normalized;
  }

  return `••${normalized.slice(-6)}`;
}

function safeErrorSummary(value) {
  if (!hasText(value)) {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 180);
}

function safeMediaFileName(value) {
  if (!hasText(value)) {
    return null;
  }

  return value.trim();
}

function safeMediaMimeType(value) {
  if (!hasText(value)) {
    return null;
  }

  return value.trim().slice(0, 120);
}

function safeMediaExtension(value) {
  if (!hasText(value)) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('.') ? normalized : `.${normalized}`;
}

function safeMediaFileSize(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function safeMediaDurationMs(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function summarizeAttempts(attempts) {
  const successfulAttempts = attempts.filter((attempt) => attempt.status === 'success').length;
  const latestAttempt = [...attempts].sort((a, b) => {
    const aTime = a.finishedAt?.getTime() ?? a.startedAt.getTime();
    const bTime = b.finishedAt?.getTime() ?? b.startedAt.getTime();
    return bTime - aTime;
  })[0];
  const hasProviderVideoAcceptance = attempts.some(
    (attempt) => attempt.status === 'success' || attempt.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION'
  );
  const latestVerificationAttempt = [...attempts]
    .filter((attempt) => attempt.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION')
    .sort((a, b) => {
      const aTime = a.finishedAt?.getTime() ?? a.startedAt.getTime();
      const bTime = b.finishedAt?.getTime() ?? b.startedAt.getTime();
      return bTime - aTime;
    })[0];

  return {
    attemptCount: attempts.length,
    successfulAttemptCount: successfulAttempts,
    hasProviderVideoAcceptance,
    latestVerificationErrorCode: latestVerificationAttempt?.errorCode ?? null,
    latestVerificationSafeErrorMessage: safeErrorSummary(latestVerificationAttempt?.errorMessage ?? null),
    latestSafeErrorMessage: safeErrorSummary(
      latestAttempt?.errorMessage ??
        attempts
          .map((attempt) => attempt.errorMessage)
          .filter(Boolean)
          .at(-1) ??
        null
    ),
  };
}

function summarizeJobs(jobs) {
  const pendingJobCount = jobs.filter((job) => job.status === 'pending').length;
  const processingJobCount = jobs.filter((job) => job.status === 'processing').length;
  const activeJobCount = pendingJobCount + processingJobCount;
  const successfulJobCount = jobs.filter((job) => job.status === 'success').length;
  const failedJobCount = jobs.filter((job) => job.status === 'failed').length;

  const allAttempts = jobs.flatMap((job) => job.attempts);
  const attemptSummary = summarizeAttempts(allAttempts);

  return {
    jobCount: jobs.length,
    pendingJobCount,
    processingJobCount,
    activeJobCount,
    successfulJobCount,
    failedJobCount,
    ...attemptSummary,
  };
}

async function snapshotPost(postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      postTargets: {
        include: {
          account: {
            select: {
              platform: true,
              accountId: true,
              accountName: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
      },
      publishJobs: {
        include: {
          attempts: {
            orderBy: {
              attemptNumber: 'asc',
            },
            select: {
              attemptNumber: true,
              status: true,
              startedAt: true,
              finishedAt: true,
              errorCode: true,
              errorMessage: true,
            },
          },
        },
        orderBy: {
          id: 'asc',
        },
      },
    },
  });

  if (!post) {
    return {
      postId,
      found: false,
      message: `post #${postId} not found in current workspace DB`,
    };
  }

  const targetSummaries = post.postTargets.map((target) => ({
    platform: target.account.platform,
    targetPageName: safePageName(target.account.accountName),
    targetStatus: target.status,
    platformPostIdSuffix: safePlatformPostIdSuffix(target.platformPostId),
    hasFbSimEvidence: hasText(target.platformPostId) && target.platformPostId.startsWith('fb_sim_'),
  }));

  const hasRealFacebookTarget = post.postTargets.some(
    (target) =>
      target.account.platform === 'facebook' &&
      hasText(target.account.accountId) &&
      !target.account.accountId.startsWith('mock_')
  );

  const jobSummary = summarizeJobs(post.publishJobs);
  const hasFbSimEvidence = targetSummaries.some((target) => target.hasFbSimEvidence);
  const hasVideoVerificationEvidence = post.publishJobs.some((job) =>
    job.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION' ||
    job.attempts.some((attempt) => attempt.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION')
  );
  const needsVerificationReason = hasVideoVerificationEvidence
    ? 'Facebook accepted the video upload but final publish confirmation was not returned.'
    : post.status === 'published' && hasRealFacebookTarget && hasFbSimEvidence
      ? 'Local snapshot indicates fb_sim_* evidence on a real Facebook target.'
      : post.status === 'needs_verification'
        ? safeErrorSummary(post.errorMessage) ?? 'Local post status requires manual verification.'
        : null;
  const needsVerification =
    post.status === 'needs_verification' ||
    hasVideoVerificationEvidence ||
    (post.status === 'published' && hasRealFacebookTarget && hasFbSimEvidence);
  const effectiveStatus = needsVerification ? 'needs_verification' : post.status;

  const mediaType = post.mediaType ?? 'none';
  const isVideo = mediaType === 'video';
  const isUnsupportedForRealPublish = isVideo;
  const realVideoPublishSupported = false;

  return {
    postId: post.id,
    found: true,
    status: post.status,
    effectiveStatus,
    needsVerification,
    needsVerificationReason,
    hasProviderVideoAcceptance: jobSummary.hasProviderVideoAcceptance,
    hasErrorMessage: hasText(post.errorMessage),
    publishedAtPresent: !!post.publishedAt,
    mediaType,
    mediaFileName: safeMediaFileName(post.mediaFileName),
    mediaFileSize: safeMediaFileSize(post.mediaFileSize),
    mediaMimeType: safeMediaMimeType(post.mediaMimeType),
    mediaExtension: safeMediaExtension(post.mediaExtension),
    mediaDurationMs: safeMediaDurationMs(post.mediaDurationMs),
    isVideo,
    isUnsupportedForRealPublish,
    realVideoPublishSupported,
    targets: targetSummaries,
    ...jobSummary,
      latestSafeErrorMessage:
      jobSummary.latestVerificationSafeErrorMessage ??
      jobSummary.latestSafeErrorMessage ??
      needsVerificationReason ??
      safeErrorSummary(post.errorMessage),
  };
}

async function snapshotDuplicateActiveJobs(postIds) {
  const grouped = await prisma.publishJob.groupBy({
    by: ['postId', 'status'],
    where: {
      postId: { in: postIds },
      status: { in: ['pending', 'processing'] },
    },
    _count: {
      _all: true,
    },
  });

  const byPost = new Map();

  for (const row of grouped) {
    const current = byPost.get(row.postId) ?? {
      postId: row.postId,
      pendingJobCount: 0,
      processingJobCount: 0,
      activeJobCount: 0,
      hasDuplicateActiveJobs: false,
    };

    if (row.status === 'pending') {
      current.pendingJobCount = row._count._all;
    }

    if (row.status === 'processing') {
      current.processingJobCount = row._count._all;
    }

    current.activeJobCount = current.pendingJobCount + current.processingJobCount;
    current.hasDuplicateActiveJobs = current.activeJobCount > 1;

    byPost.set(row.postId, current);
  }

  return postIds.map((postId) => {
    const current =
      byPost.get(postId) ?? {
        postId,
        pendingJobCount: 0,
        processingJobCount: 0,
        activeJobCount: 0,
        hasDuplicateActiveJobs: false,
      };

    return current;
  });
}

async function main() {
  const postIds = parsePostIds(process.argv.slice(2));

  if (postIds.length === 0) {
    console.error('Usage: node scripts/snapshot-posts.mjs <postId> [postId...]');
    process.exit(1);
  }

  const snapshots = [];
  for (const postId of postIds) {
    snapshots.push(await snapshotPost(postId));
  }

  const duplicateActiveJobs = await snapshotDuplicateActiveJobs(postIds);

  const payload = {
    script: 'snapshot-posts.mjs',
    mode: 'local_read_only_prisma_snapshot',
    safeDefaultRealPublishEnabled: process.env.FACEBOOK_REAL_PUBLISH_ENABLED ?? 'false',
    note:
      'Historical Phase 16.6 snapshot and current workspace DB snapshot may differ if dev.db was reset, copied, or restored.',
    postIds,
    posts: snapshots,
    duplicateActiveJobs,
  };

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          script: 'snapshot-posts.mjs',
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    setTimeout(() => {
      process.exit(process.exitCode ?? 0);
    }, 0);
  });