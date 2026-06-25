import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Service for managing publish jobs
 * Handles creation, retrieval, and updating of publish jobs
 */
export class PublishJobService {
  /**
   * Create publish jobs for a post to all its target accounts
   */
  async createJobsForPost(postId: number): Promise<number> {
    try {
      logger.info(`[PublishJobService] Creating publish jobs for post ${postId}`);


      // Get post with targets
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: {
          postTargets: {
            include: { account: true }
          }
        }
      });


      if (!post) {
        throw new Error(`Post ${postId} not found`);
      }


      if (post.status !== 'scheduled' && post.status !== 'queued') {
        logger.warn(`[PublishJobService] Post ${postId} is not in schedulable status: ${post.status}`);
        return 0;
      }


      const existingActiveJobs = await prisma.publishJob.findMany({
        where: {
          postId,
          status: {
            in: ['pending', 'processing'],
          },
        },
        select: {
          accountId: true,
          pageId: true,
        },
      });

      const existingActiveTargetKeys = new Set(
        existingActiveJobs.map((job) => `${job.accountId}:${job.pageId ?? ''}`)
      );

      const jobs = [];
      for (const target of post.postTargets) {
        if (target.account.status !== 'active') {
          logger.info(`[PublishJobService] Skipping inactive account ${target.account.id} for post ${postId}`);
          continue;
        }

        const isExplicitFacebookPageTarget =
          target.account.platform === 'facebook' && target.targetType === 'page';

        if (isExplicitFacebookPageTarget && !target.pageId) {
          logger.warn(
            `[PublishJobService] Skipping invalid Facebook page target postId=${postId} accountId=${target.accountId} missingPageId=true`
          );
          continue;
        }

        const targetKey = `${target.accountId}:${target.pageId ?? ''}`;
        if (existingActiveTargetKeys.has(targetKey)) {
          logger.info(
            `[PublishJobService] Skipping duplicate active job for postId=${postId} accountId=${target.accountId} pageId=${target.pageId ?? 'none'}`
          );
          continue;
        }

        jobs.push({
          postId,
          accountId: target.accountId,
          platform: target.account.platform as 'facebook' | 'tiktok',
          pageId: target.pageId ?? null,
          pageName: target.pageName ?? null,
          sourceAccountName: target.sourceAccountName ?? target.account.accountName ?? null,
          status: 'pending',
          priority: 0,
        });
        existingActiveTargetKeys.add(targetKey);
      }


      if (jobs.length === 0) {
        logger.warn(`[PublishJobService] No new valid targets found for post ${postId}`);
        return 0;
      }


      // Create all jobs
      const createdJobs = await prisma.publishJob.createMany({
        data: jobs
        // skipDuplicates: true, // Not supported in this Prisma version
      });


      logger.info(`[PublishJobService] Created ${createdJobs.count} publish jobs for post ${postId}`);


      // Update post status to queued
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'queued' },
      });


      return createdJobs.count;
    } catch (error) {
      logger.error(`[PublishJobService] Failed to create jobs for post ${postId}`, { error });
      throw error;
    }
  }


  /**
   * Get pending jobs ready for processing
   */
  async getPendingJobs(limit: number = 10): Promise<Array<{
    id: number;
    postId: number;
    accountId: number;
    platform: string;
    pageId: string | null;
    pageName: string | null;
    sourceAccountName: string | null;
    retryCount: number;
    post: {
      id: number;
      title: string | null;
      content: string;
      mediaType: string | null;
      mediaUrl: string | null;
      mediaLocalPath: string | null;
      hashtags: string | null;
    };
    account: {
      id: number;
      platform: string;
      accountId: string;
      accountName: string;
      avatarUrl: string | null;
    };
  }>> {
    try {
      const jobs = await prisma.publishJob.findMany({
        where: {
          status: 'pending',
          OR: [
            { nextRetryAt: null },
            { nextRetryAt: { lte: new Date() } }
          ]
        },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              content: true,
              mediaType: true,
              mediaUrl: true,
              mediaLocalPath: true,
              hashtags: true
            }
          },
          account: {
            select: {
              id: true,
              platform: true,
              accountId: true,
              accountName: true,
              avatarUrl: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' }
        ],
        take: limit
      });


      return jobs.map(job => ({
        id: job.id,
        postId: job.postId,
        accountId: job.accountId,
        platform: job.platform,
        pageId: job.pageId,
        pageName: job.pageName,
        sourceAccountName: job.sourceAccountName,
        retryCount: job.retryCount,
        post: {
          id: job.post.id,
          title: job.post.title,
          content: job.post.content,
          mediaType: job.post.mediaType,
          mediaUrl: job.post.mediaUrl,
          mediaLocalPath: job.post.mediaLocalPath,
          hashtags: job.post.hashtags
        },
        account: {
          id: job.account.id,
          platform: job.account.platform,
          accountId: job.account.accountId,
          accountName: job.account.accountName,
          avatarUrl: job.account.avatarUrl
        }
      }));
    } catch (error) {
      logger.error('[PublishJobService] Failed to get pending jobs', { error });
      throw error;
    }
  }


  /**
   * Get job by ID
   */
  async getJobById(id: number) {
    try {
      const job = await prisma.publishJob.findUnique({
        where: { id },
        include: {
          post: true,
          account: true,
          attempts: {
            orderBy: { attemptNumber: 'desc' }
          }
        }
      });


      return job;
    } catch (error) {
      logger.error(`[PublishJobService] Failed to get job ${id}`, { error });
      throw error;
    }
  }


  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: number,

    status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled',
    errorCode?: string,
    errorMessage?: string
  ) {
    try {
      const data: any = {
        status,
        updatedAt: new Date()
      };


      if (status === 'processing') {
        data.startedAt = new Date();
      }


      if (status === 'success' || status === 'failed' || status === 'cancelled') {
        data.completedAt = new Date();
      }


      if (errorCode) data.errorCode = errorCode;
      if (errorMessage) data.errorMessage = errorMessage;


      const job = await prisma.publishJob.update({
        where: { id: jobId },
        data
      });


      logger.info(`[PublishJobService] Updated job ${jobId} status to ${status}`);
      return job;
    } catch (error) {
      logger.error(`[PublishJobService] Failed to update job ${jobId} status`, { error });
      throw error;
    }
  }


  /**
   * Increment retry count and set next retry time
   */
  async incrementRetry(
    jobId: number,

    baseDelayMinutes: number = 1,

    maxRetries: number = 3
  ): Promise<boolean> {
    try {
      const job = await prisma.publishJob.findUnique({
        where: { id: jobId }
      });


      if (!job) {
        logger.warn(`[PublishJobService] Job ${jobId} not found for retry`);
        return false;
      }


      if (job.retryCount >= maxRetries) {
        logger.warn(`[PublishJobService] Job ${jobId} exceeded max retries (${job.retryCount}/${maxRetries})`);
        await this.updateJobStatus(jobId, 'failed', 'MAX_RETRIES_EXCEEDED', 'Maximum retry attempts exceeded');
        return false;
      }


      const retryCount = job.retryCount + 1;
      // Exponential backoff: baseDelay * 2^(retryCount-1) minutes
      const delayMinutes = baseDelayMinutes * Math.pow(2, retryCount - 1);
      const nextRetryAt = new Date(Date.now() + delayMinutes * 60 * 1000);


      await prisma.publishJob.update({
        where: { id: jobId },
        data: {
          retryCount,
          nextRetryAt,
          status: 'pending', // Reset to pending for retry
          updatedAt: new Date()
        }
      });


      logger.info(`[PublishJobService] Incremented retry for job ${jobId} to ${retryCount}/${maxRetries}, next retry in ${delayMinutes} minutes`);
      return true;
    } catch (error) {
      logger.error(`[PublishJobService] Failed to increment retry for job ${jobId}`, { error });
      return false;
    }
  }


  /**
   * Get job statistics
   */
  async getJobStats() {
    try {
      const stats = await prisma.publishJob.groupBy({
        by: ['status'],
        _count: true
      });


      const result: Record<string, number> = {};
      stats.forEach(({ status, _count }) => {
        result[status] = _count;
      });


      return result;
    } catch (error) {
      logger.error('[PublishJobService] Failed to get job stats', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const publishJobService = new PublishJobService();