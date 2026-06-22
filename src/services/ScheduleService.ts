import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import PostService from './PostService';
import LoggerService from './LoggerService';
import { publishJobService } from './PublishJobService';
import { queueService } from './QueueService';
import { jobLockService } from './JobLockService';
import { notificationService } from './NotificationService';
import { appSettingsService } from './AppSettingsService';

/**
 * Enhanced Schedule Service
 * Runs reliably in the Electron main process, detects due/missed posts,
 * creates publish jobs safely, prevents duplicates, and supports recovery.
 */
class ScheduleService {
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isChecking = false;
  private readonly lockIdentifier = `scheduler-${process.pid}`;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[ScheduleService] Schedule service is already running');
      return;
    }

    const settings = await appSettingsService.getSchedulerSettings();
    if (!settings.autoPostingEnabled) {
      logger.info('[ScheduleService] Auto posting is disabled in settings');
      return;
    }

    const intervalMs = Math.max(1, settings.interval) * 60 * 1000;

    this.intervalHandle = setInterval(async () => {
      await this.checkAndQueueScheduledPosts();
    }, intervalMs);

    this.isRunning = true;

    await this.logSchedulerEvent('started', 'Schedule service started', {
      intervalMinutes: settings.interval,
    });

    await this.runStartupRecovery();

    queueService.startProcessing().catch((error) => {
      logger.error('[ScheduleService] Failed to start queue processing', { error });
    });

    logger.info('[ScheduleService] Schedule service started');
    await LoggerService.log('info', 'Schedule service started');
  }

  async stop(): Promise<void> {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    this.isRunning = false;
    queueService.stopProcessing();

    await this.logSchedulerEvent('stopped', 'Schedule service stopped');

    logger.info('[ScheduleService] Schedule service stopped');
    await LoggerService.log('info', 'Schedule service stopped');
  }

  private async runStartupRecovery(): Promise<void> {
    try {
      const releasedLocks = await jobLockService.releaseExpiredLocks();
      const recoveredPosts = await this.recoverInterruptedPosts();
      const missedPosts = await this.detectMissedScheduledPosts();

      await this.logSchedulerEvent('recovery', 'Startup recovery completed', {
        releasedLocks,
        recoveredPosts,
        missedPosts,
      });
    } catch (error) {
      logger.error('[ScheduleService] Startup recovery failed', { error });
      await this.logSchedulerEvent('error', 'Startup recovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async recoverInterruptedPosts(): Promise<number> {
    const interruptedPosts = await prisma.post.findMany({
      where: {
        status: {
          in: ['queued', 'posting'],
        },
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
      },
    });

    let recoveredCount = 0;

    for (const post of interruptedPosts) {
      const activeJobs = await prisma.publishJob.findMany({
        where: {
          postId: post.id,
          status: {
            in: ['pending', 'processing'],
          },
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const processingJobs = activeJobs.filter((job) => job.status === 'processing');
      const pendingJobs = activeJobs.filter((job) => job.status === 'pending');

      if (post.status === 'queued') {
        if (pendingJobs.length > 0 && processingJobs.length === 0) {
          logger.info('[ScheduleService] Preserving queued post with pending jobs during startup recovery', {
            postId: post.id,
            pendingJobs: pendingJobs.length,
          });
          continue;
        }

        if (processingJobs.length === 0 && pendingJobs.length === 0) {
          const fallbackStatus = post.scheduledAt ? 'scheduled' : 'failed';
          await prisma.post.update({
            where: { id: post.id },
            data: {
              status: fallbackStatus,
              errorMessage:
                fallbackStatus === 'failed'
                  ? 'Recovered after startup with no active queue job remaining.'
                  : null,
              lockedAt: null,
              lockedBy: null,
              updatedAt: new Date(),
            },
          });

          recoveredCount += 1;
          continue;
        }
      }

      if (processingJobs.length > 0) {
        await prisma.publishJob.updateMany({
          where: {
            id: {
              in: processingJobs.map((job) => job.id),
            },
          },
          data: {
            status: 'cancelled',
            errorCode: 'RECOVERED_ON_STARTUP',
            errorMessage: 'Cancelled during startup recovery after the app restarted while the job was processing.',
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        const fallbackStatus = post.scheduledAt ? 'scheduled' : 'failed';
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: fallbackStatus,
            errorMessage:
              fallbackStatus === 'failed'
                ? 'Publishing was interrupted during startup recovery before completion could be verified.'
                : null,
            lockedAt: null,
            lockedBy: null,
            updatedAt: new Date(),
          },
        });

        recoveredCount += 1;
        continue;
      }

      if (post.status === 'posting' && pendingJobs.length > 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            status: 'queued',
            errorMessage: null,
            lockedAt: null,
            lockedBy: null,
            updatedAt: new Date(),
          },
        });

        logger.warn('[ScheduleService] Downgraded posting post back to queued because pending jobs still exist', {
          postId: post.id,
          pendingJobs: pendingJobs.length,
        });

        recoveredCount += 1;
      }
    }

    if (recoveredCount > 0) {
      logger.info(`[ScheduleService] Recovered ${recoveredCount} interrupted posts`);
    }

    return recoveredCount;
  }

  private async detectMissedScheduledPosts(): Promise<number> {
    const now = new Date();
    const missedPosts = await prisma.post.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: {
          lte: now,
        },
      },
    });

    for (const post of missedPosts) {
      await this.queuePostSafely(post.id, true);
    }

    if (missedPosts.length > 0) {
      logger.info(`[ScheduleService] Detected ${missedPosts.length} missed scheduled posts`);
    }

    return missedPosts.length;
  }

  private async checkAndQueueScheduledPosts(): Promise<void> {
    if (this.isChecking) {
      logger.warn('[ScheduleService] Scheduler check skipped because previous run is still active');
      return;
    }

    this.isChecking = true;

    try {
      const settings = await appSettingsService.getSchedulerSettings();
      if (!settings.autoPostingEnabled) {
        return;
      }

      const scheduledPosts = await PostService.getScheduledPosts();

      await this.logSchedulerEvent(
        'check',
        `Scheduler checked ${scheduledPosts.length} due posts`,
        { count: scheduledPosts.length }
      );

      for (const post of scheduledPosts) {
        await this.queuePostSafely(post.id, false);
      }
    } catch (error) {
      logger.error('[ScheduleService] Error checking scheduled posts', { error });
      await LoggerService.log('error', 'Error checking scheduled posts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.logSchedulerEvent('error', 'Error checking scheduled posts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.isChecking = false;
    }
  }

  private async queuePostSafely(postId: number, isMissedPost: boolean): Promise<void> {
    const locked = await jobLockService.acquireLock(postId, this.lockIdentifier);
    if (!locked) {
      logger.warn(`[ScheduleService] Post ${postId} is already locked, skipping duplicate queueing`);
      return;
    }

    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!post) {
        logger.warn(`[ScheduleService] Post ${postId} not found during queue attempt`);
        return;
      }

      if (post.status === 'scheduled') {
        const cancelledOrphanedJobs = await prisma.publishJob.updateMany({
          where: {
            postId,
            status: {
              in: ['pending', 'processing'],
            },
          },
          data: {
            status: 'cancelled',
            errorCode: 'ORPHANED_ACTIVE_JOB',
            errorMessage: 'Cancelled because the post was rescheduled during recovery before re-queue.',
            completedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        if (cancelledOrphanedJobs.count > 0) {
          logger.warn('[ScheduleService] Cancelled orphaned active jobs before re-queue', {
            postId,
            cancelledJobs: cancelledOrphanedJobs.count,
            isMissedPost,
          });

          await this.logSchedulerEvent(
            'recovery',
            `Cancelled ${cancelledOrphanedJobs.count} orphaned active jobs for post ${postId}`,
            { postId, cancelledJobs: cancelledOrphanedJobs.count, isMissedPost }
          );
        }
      }

      const existingJobs = await prisma.publishJob.count({
        where: {
          postId,
          status: {
            in: ['pending', 'processing'],
          },
        },
      });

      if (existingJobs > 0) {
        logger.info(`[ScheduleService] Post ${postId} already has ${existingJobs} active jobs, skipping duplicate queue`);
        return;
      }

      const createdJobs = await publishJobService.createJobsForPost(postId);

      if (createdJobs > 0) {
        await prisma.post.update({
          where: { id: postId },
          data: {
            status: 'queued',
            updatedAt: new Date(),
          },
        });

        await this.logSchedulerEvent(
          'job_queued',
          `Queued ${createdJobs} jobs for post ${postId}`,
          { postId, createdJobs, isMissedPost }
        );

        await notificationService.createNotification({
          type: 'info',
          title: isMissedPost ? 'Missed post recovered' : 'Post queued',
          message: isMissedPost
            ? `A missed scheduled post (#${postId}) was recovered and queued`
            : `Post #${postId} was queued for publishing`,
          relatedPostId: postId,
        });
      }
    } catch (error) {
      logger.error(`[ScheduleService] Failed to queue post ${postId}`, { error });
      await this.logSchedulerEvent('error', `Failed to queue post ${postId}`, {
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await jobLockService.releaseLock(postId, this.lockIdentifier);
    }
  }

  private async logSchedulerEvent(
    eventType: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.schedulerEvent.create({
        data: {
          eventType,
          message,
          data: data ? JSON.stringify(data) : null,
        },
      });
    } catch (error) {
      logger.error('[ScheduleService] Failed to log scheduler event', { error });
    }
  }

  async runManualCheck(): Promise<void> {
    await this.checkAndQueueScheduledPosts();
  }

  async getStatus(): Promise<{
    isRunning: boolean;
    isChecking: boolean;
    queue: {
      pending: number;
      processing: number;
      success: number;
      failed: number;
      cancelled: number;
      isProcessing: boolean;
    };
  }> {
    const queue = await queueService.getQueueStats();

    return {
      isRunning: this.isRunning,
      isChecking: this.isChecking,
      queue,
    };
  }
}

export default new ScheduleService();