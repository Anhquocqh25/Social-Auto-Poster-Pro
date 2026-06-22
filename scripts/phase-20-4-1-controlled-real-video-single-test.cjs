const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REAL_ACCOUNT_ID = 6;
const TEST_VIDEO_PATH = path.resolve(
  process.cwd(),
  '.tmp/phase-20-4-1-media/phase-20-4-1-test-video.mp4'
);

async function createQueuedVideoPost() {
  const fs = require('fs');
  const videoStat = fs.statSync(TEST_VIDEO_PATH);

  const post = await prisma.post.create({
    data: {
      title: 'Controlled real video upload test — Phase 20.4.1',
      content: 'Controlled real video upload test — Phase 20.4.1',
      mediaType: 'video',
      mediaLocalPath: TEST_VIDEO_PATH,
      mediaFileName: path.basename(TEST_VIDEO_PATH),
      mediaFileSize: videoStat.size,
      mediaMimeType: 'video/mp4',
      mediaExtension: '.mp4',
      status: 'queued',
      postTargets: {
        create: [
          {
            accountId: REAL_ACCOUNT_ID,
            status: 'pending',
          },
        ],
      },
    },
    include: {
      postTargets: true,
    },
  });

  const job = await prisma.publishJob.create({
    data: {
      postId: post.id,
      accountId: REAL_ACCOUNT_ID,
      platform: 'facebook',
      status: 'pending',
      priority: 0,
      retryCount: 0,
      maxRetries: 0,
    },
  });

  return {
    postId: post.id,
    jobId: job.id,
    mediaType: 'video',
    mediaLocalPath: TEST_VIDEO_PATH,
    mediaFileSize: videoStat.size,
  };
}

async function main() {
  const created = await createQueuedVideoPost();

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: {
          realAccountId: REAL_ACCOUNT_ID,
          maxPosts: 1,
          pageCount: 1,
          textCount: 0,
          imageCount: 0,
          videoCount: 1,
        },
        created,
      },
      null,
      2
    )
  );
}

main()
  .catch(async (error) => {
    console.error(
      JSON.stringify(
        {
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
  });