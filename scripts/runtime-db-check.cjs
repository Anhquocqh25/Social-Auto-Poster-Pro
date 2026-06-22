const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const [
    postCount,
    scheduledCount,
    jobCount,
    attemptCount,
    notificationCount,
    settingCount,
    posts,
    jobs,
    attempts,
    notifications,
  ] = await Promise.all([
    prisma.post.count(),
    prisma.post.count({ where: { status: 'scheduled' } }),
    prisma.publishJob.count(),
    prisma.publishAttempt.count(),
    prisma.notification.count(),
    prisma.appSetting.count(),
    prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        publishedAt: true,
        errorMessage: true,
      },
    }),
    prisma.publishJob.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        postId: true,
        platform: true,
        status: true,
        retryCount: true,
        errorMessage: true,
      },
    }),
    prisma.publishAttempt.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        jobId: true,
        attemptNumber: true,
        status: true,
        errorMessage: true,
      },
    }),
    prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        type: true,
        title: true,
        isRead: true,
      },
    }),
  ]);

  console.log(
    JSON.stringify(
      {
        counts: {
          postCount,
          scheduledCount,
          jobCount,
          attemptCount,
          notificationCount,
          settingCount,
        },
        posts,
        jobs,
        attempts,
        notifications,
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