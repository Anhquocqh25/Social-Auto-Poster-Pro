const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const REAL_ACCOUNT_ID = 6;
const TEST_IMAGE_PATH = path.resolve(process.cwd(), '.tmp/phase-20-1-media/phase-20-1-test-image.png');

async function createQueuedPost({ content, mediaType = 'none', mediaLocalPath = null, mediaFileName = null, mediaFileSize = null, mediaMimeType = null, mediaExtension = null }) {
  const post = await prisma.post.create({
    data: {
      title: null,
      content,
      mediaType,
      mediaLocalPath,
      mediaFileName,
      mediaFileSize,
      mediaMimeType,
      mediaExtension,
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
      maxRetries: 3,
    },
  });

  return {
    postId: post.id,
    jobId: job.id,
    mediaType,
    content,
  };
}

async function main() {
  const imageStat = require('fs').statSync(TEST_IMAGE_PATH);

  const created = [];
  created.push(
    await createQueuedPost({
      content: 'Controlled real publish test — Phase 20.1 text',
      mediaType: 'none',
    })
  );

  created.push(
    await createQueuedPost({
      content: 'Controlled real publish test — Phase 20.1 image',
      mediaType: 'photo',
      mediaLocalPath: TEST_IMAGE_PATH,
      mediaFileName: path.basename(TEST_IMAGE_PATH),
      mediaFileSize: imageStat.size,
      mediaMimeType: 'image/png',
      mediaExtension: '.png',
    })
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: {
          realAccountId: REAL_ACCOUNT_ID,
          maxPosts: 2,
          pageCount: 1,
          textCount: 1,
          imageCount: 1,
          videoCount: 0,
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