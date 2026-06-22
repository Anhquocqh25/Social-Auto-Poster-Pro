import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { publishJobService } from './PublishJobService';
import PostService from './PostService';
import { accountService } from './AccountService';
import { facebookService } from './facebook/FacebookService';
import { facebookPublishReadinessService } from './facebook/FacebookPublishReadinessService';
import { loadFacebookEnvConfig } from './facebook/FacebookConfigService';
import { notificationService } from './NotificationService';

/**
 * Queue Service
 * Manages the publishing queue with retry mechanisms and rate limiting
 */
export class QueueService {
  private processing = false;
  private readonly batchSize = 5; // Process 5 jobs at a time
  private readonly delayBetweenBatches = 2000; // 2 seconds between batches

  /**
   * Start processing the queue
   */
  async startProcessing() {
    if (this.processing) {
      logger.warn('[QueueService] Queue processing is already running');
      return;
    }

    this.processing = true;
    logger.info('[QueueService] Started queue processing');

    while (this.processing) {
      try {
        await this.processBatch();
        // Wait before next batch
        await new Promise(resolve => setTimeout(resolve, this.delayBetweenBatches));
      } catch (error) {
        logger.error('[QueueService] Error in queue processing loop', { error });
        // Continue processing despite errors
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait longer on error
      }
    }
  }

  /**
   * Stop processing the queue
   */
  stopProcessing() {
    this.processing = false;
    logger.info('[QueueService] Stopped queue processing');
  }

  /**
   * Process a batch of pending jobs
   */
  private async processBatch() {
    // Get pending jobs
    const pendingJobs = await publishJobService.getPendingJobs(this.batchSize);
    
    if (pendingJobs.length === 0) {
      return; // No jobs to process
    }

    logger.info(`[QueueService] Processing batch of ${pendingJobs.length} jobs`);

    // Process jobs one by one (per platform/account to avoid rate limits)
    for (const job of pendingJobs) {
      if (!this.processing) break; // Check if we should stop

      try {
        await this.processJob(job);
      } catch (error) {
        logger.error(`[QueueService] Failed to process job ${job.id}`, { error });
        // The job processing function will handle retry logic
      }

      // Small delay between jobs to avoid overwhelming APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Process a single publish job
   */
  private async processJob(job: any) {
    const attemptNumber = job.retryCount + 1;

    console.info(`[Queue] worker picked jobId=${job.id} postId=${job.postId}`);

    logger.info('[QueueService] Publish attempt started', {
      jobId: job.id,
      postId: job.postId,
      platform: job.platform,
      accountId: job.accountId,
      attemptNumber,
      retryCount: job.retryCount,
    });

    try {
      // Get the post and account details
      const post = await PostService.getPost(job.postId);
      if (!post) {
        throw new Error(`Post ${job.postId} not found`);
      }

      // Get account (we need the decrypted token)
      const account = await accountService.getAccount(job.accountId);
      if (!account) {
        throw new Error(`Account ${job.accountId} not found`);
      }

      // Update job status to processing
      await publishJobService.updateJobStatus(job.id, 'processing');
      await prisma.post.update({
        where: { id: job.postId },
        data: {
          status: 'posting',
          errorMessage: null,
          updatedAt: new Date(),
        },
      });

      // Publish to the specific platform
      let success = false;
      let errorCode: string | undefined;
      let errorMessage: string | undefined;
      let responseData: string | undefined;
      let finalState: 'published' | 'failed' | 'needs_verification' = 'failed';

      try {
        logger.info('[QueueService] Invoking platform publisher', {
          jobId: job.id,
          postId: job.postId,
          platform: job.platform,
          attemptNumber,
        });

        switch (job.platform) {
          case 'facebook': {
            const isSimulationAccount = account.accountId.startsWith('mock_facebook_');
            const publishMode = isSimulationAccount ? 'simulation' : 'real';

            let publishMessage = post.content;

            if (publishMode === 'simulation' && post.content.includes('[simulate:partial_failure]')) {
              publishMessage = account.accountId.includes('secondary')
                ? `${post.content}\n[simulate:always_fail]`
                : post.content.replace('[simulate:partial_failure]', '[simulate:success_path]');
            }

            if (publishMode === 'real') {
              const resolvedTarget = await facebookPublishReadinessService.resolveFacebookPublishTarget(
                job.postId
              );

              if (!resolvedTarget.ok) {
                console.info(
                  `[Queue] publish start postId=${job.postId} platform=facebook mediaType=${post.mediaType ?? 'none'}`
                );
                success = false;
                errorCode = 'FACEBOOK_REAL_PUBLISH_BLOCKED';
                errorMessage =
                  resolvedTarget.blockedReason === 'missing_page_access_token'
                    ? 'Real Facebook publishing is blocked because the encrypted Facebook Page token is missing.'
                    : resolvedTarget.blockedReason === 'legacy_account_target'
                      ? 'Real Facebook publishing is blocked because this post still uses a legacy account target.'
                      : `Real Facebook publishing is blocked: ${resolvedTarget.blockedReason ?? 'unknown readiness issue'}.`;

                responseData = JSON.stringify({
                  blockedReason: resolvedTarget.blockedReason ?? 'unknown',
                  pageName: resolvedTarget.pageName ?? null,
                  pageIdMasked: resolvedTarget.pageIdMasked ?? null,
                  hasEncryptedPageToken: resolvedTarget.hasEncryptedPageToken ?? false,
                  missingPermissions: resolvedTarget.missingPermissions ?? [],
                });
                } else {
                  const facebookEnv = loadFacebookEnvConfig();

                if (!facebookEnv.realPublishingEnabled) {
                  success = false;
                  errorCode = 'FACEBOOK_REAL_PUBLISH_BLOCKED';
                  errorMessage =
                    'Real Facebook publishing remains disabled until Phase 7 publish enablement is explicitly turned on.';
                  responseData = JSON.stringify({
                    blockedReason: 'real_publishing_disabled',
                    pageName: resolvedTarget.target.pageName,
                    pageIdMasked: resolvedTarget.target.pageIdMasked,
                    hasEncryptedPageToken: resolvedTarget.target.hasEncryptedPageToken,
                  });
                  } else {
                    console.info(
                      `[Queue] publish start postId=${job.postId} platform=facebook mediaType=${post.mediaType ?? 'none'}`
                    );
                    const fbResult = await facebookService.publishForAccount({
                    accountId: resolvedTarget.target.accountId,
                    pageId: resolvedTarget.target.pageId,
                    message: publishMessage,
                    mediaType: (post.mediaType as 'photo' | 'video' | 'none' | null) ?? 'none',
                    mediaUrl: post.mediaUrl ?? undefined,
                    mediaLocalPath: post.mediaLocalPath ?? undefined,
                    publishMode,
                  });

                  success = fbResult.success;
                  errorCode = fbResult.errorCode;
                  errorMessage = fbResult.errorMessage;
                  responseData = JSON.stringify(fbResult.rawResponse ?? { id: fbResult.postId });
                  finalState = fbResult.finalState ?? (fbResult.success ? 'published' : 'failed');
                }
              }
            } else {
              const fbResult = await facebookService.publishForAccount({
                accountId: job.accountId,
                pageId: `fb_sim_page_${job.accountId}`,
                pageAccessToken: 'simulation_page_token',
                message: publishMessage,
                mediaType: (post.mediaType as 'photo' | 'video' | 'none' | null) ?? 'none',
                mediaUrl: post.mediaUrl ?? undefined,
                mediaLocalPath: post.mediaLocalPath ?? undefined,
                publishMode,
              });

              success = fbResult.success;
              errorCode = fbResult.errorCode;
              errorMessage = fbResult.errorMessage;
              responseData = JSON.stringify(fbResult.rawResponse ?? { id: fbResult.postId });
              finalState = fbResult.finalState ?? (fbResult.success ? 'published' : 'failed');
            }

            if (!success && publishMode === 'real') {
              logger.warn('[QueueService] Facebook real publish blocked by readiness gate', {
                accountId: job.accountId,
                jobId: job.id,
                attemptNumber,
                errorCode,
                errorMessage,
              });
            }

            break;
          }
          case 'tiktok':
            // TikTok not implemented yet as per requirements
            throw new Error('TikTok publishing not yet implemented');
          default:
            throw new Error(`Unsupported platform: ${job.platform}`);
        }
      } catch (publishError: any) {
        success = false;
        errorCode = publishError?.code || 'PUBLISH_FAILED';
        errorMessage = publishError?.message || 'Unknown error';
        finalState = 'failed';
        responseData = JSON.stringify({
          error: publishError?.message || 'Unknown error',
          stack: publishError?.stack
        });
      }

      if (success && finalState === 'published') {
        console.info(`[Queue] publish success postId=${job.postId}`);
        // Mark job as successful
        await publishJobService.updateJobStatus(job.id, 'success');

        // Update post target status
        await prisma.postTarget.updateMany({
          where: {
            postId: job.postId,
            accountId: job.accountId
          },
          data: {
            status: 'success',
            platformPostId: responseData ? JSON.parse(responseData).id : undefined,
            updatedAt: new Date()
          }
        });

        const remainingIncompleteTargets = await prisma.postTarget.count({
          where: {
            postId: job.postId,
            status: {
              in: ['pending', 'failed'],
            },
          },
        });

        if (remainingIncompleteTargets === 0) {
          await prisma.post.update({
            where: { id: job.postId },
            data: {
              status: 'published',
              publishedAt: new Date(),
              errorMessage: null,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.post.update({
            where: { id: job.postId },
            data: {
              status: 'posting',
              updatedAt: new Date(),
            },
          });
        }

        await notificationService.createNotification({
          type: 'success',
          title: 'Publish succeeded',
          message: `Post #${job.postId} published successfully for account #${job.accountId}.`,
          relatedPostId: job.postId,
          relatedJobId: job.id,
        });

        logger.info('[QueueService] Publish attempt succeeded', {
          jobId: job.id,
          postId: job.postId,
          accountId: job.accountId,
          attemptNumber,
          responseData,
        });
      } else if (success && finalState === 'needs_verification') {
        const verificationMessage =
          'Facebook video upload requires verification before it can be treated as published.';
        const targetVerificationMessage =
          'Video upload was accepted by Facebook but final publish confirmation was not returned. Manual verification is required.';

        await publishJobService.updateJobStatus(
          job.id,
          'failed',
          'FACEBOOK_VIDEO_NEEDS_VERIFICATION',
          verificationMessage
        );

        await prisma.postTarget.updateMany({
          where: {
            postId: job.postId,
            accountId: job.accountId
          },
          data: {
            status: 'failed',
            errorMessage: targetVerificationMessage,
            updatedAt: new Date()
          }
        });

        await prisma.post.update({
          where: { id: job.postId },
          data: {
            status: 'needs_verification',
            errorMessage: verificationMessage,
            updatedAt: new Date(),
          },
        });

        await notificationService.createNotification({
          type: 'warning',
          title: 'Video upload needs verification',
          message: `Post #${job.postId} reached Facebook upload acceptance but final publish confirmation was not returned.`,
          relatedPostId: job.postId,
          relatedJobId: job.id,
        });

        logger.warn('[QueueService] Publish outcome requires verification', {
          jobId: job.id,
          postId: job.postId,
          accountId: job.accountId,
          attemptNumber,
          errorCode: 'FACEBOOK_VIDEO_NEEDS_VERIFICATION',
          errorMessage: verificationMessage,
          responseData,
        });
      } else {
        // Handle failure
        const maxRetries = 3; // Could be made configurable
        let parsedResponseData: Record<string, unknown> | null = null;
        try {
          parsedResponseData = responseData ? JSON.parse(responseData) as Record<string, unknown> : null;
        } catch {
          parsedResponseData = null;
        }

        const safeEndpointCategory =
          parsedResponseData && typeof parsedResponseData.endpointCategory === 'string'
            ? parsedResponseData.endpointCategory
            : null;
        const safeRetryable =
          parsedResponseData && typeof parsedResponseData.retryable === 'boolean'
            ? parsedResponseData.retryable
            : null;
        const isRealFacebookImageProviderFailure =
          job.platform === 'facebook' &&
          !account.accountId.startsWith('mock_') &&
          post.mediaType === 'photo' &&
          safeEndpointCategory === 'photo_upload' &&
          safeRetryable === true;
        const isRealFacebookVideoAttempt =
          job.platform === 'facebook' &&
          !account.accountId.startsWith('mock_') &&
          post.mediaType === 'video';

        const nonRetryableErrorCodes = new Set([
          'SIMULATION_FORCED_FAILURE',
          'FACEBOOK_REAL_PUBLISH_BLOCKED',
          'FACEBOOK_REAL_PUBLISH_DISABLED',
          'FACEBOOK_CONFIG_INVALID',
          'FACEBOOK_VALIDATION_FAILED',
          'FACEBOOK_PAGE_TOKEN_MISSING',
          'UNSUPPORTED_MULTIPLE_IMAGES_FOR_REAL_PUBLISH',
          'UNSUPPORTED_MEDIA_FOR_REAL_PUBLISH',
          'FACEBOOK_LOCAL_IMAGE_MISSING',
          'FACEBOOK_UNSUPPORTED_IMAGE_TYPE',
          'FACEBOOK_LOCAL_VIDEO_MISSING',
          'FACEBOOK_UNSUPPORTED_VIDEO_TYPE',
          'FACEBOOK_REAL_VIDEO_LOCAL_FILE_REQUIRED',
          'FACEBOOK_VIDEO_UPLOAD_NOT_CONFIRMED',
          'FACEBOOK_GRAPH_MISSING_VIDEO_ID',
          'FACEBOOK_VIDEO_NEEDS_VERIFICATION',
        ]);
        const isBlockedFailure = new Set([
          'FACEBOOK_REAL_PUBLISH_BLOCKED',
          'FACEBOOK_REAL_PUBLISH_DISABLED',
          'FACEBOOK_CONFIG_INVALID',
          'FACEBOOK_VALIDATION_FAILED',
          'FACEBOOK_PAGE_TOKEN_MISSING',
          'UNSUPPORTED_MULTIPLE_IMAGES_FOR_REAL_PUBLISH',
          'UNSUPPORTED_MEDIA_FOR_REAL_PUBLISH',
          'FACEBOOK_LOCAL_IMAGE_MISSING',
          'FACEBOOK_UNSUPPORTED_IMAGE_TYPE',
          'FACEBOOK_LOCAL_VIDEO_MISSING',
          'FACEBOOK_UNSUPPORTED_VIDEO_TYPE',
          'FACEBOOK_REAL_VIDEO_LOCAL_FILE_REQUIRED',
          'FACEBOOK_VIDEO_UPLOAD_NOT_CONFIRMED',
          'FACEBOOK_GRAPH_MISSING_VIDEO_ID',
          'FACEBOOK_VIDEO_NEEDS_VERIFICATION',
        ]).has(errorCode ?? '');
        const isNonRetryableFailure =
          nonRetryableErrorCodes.has(errorCode ?? '') ||
          isRealFacebookImageProviderFailure ||
          isRealFacebookVideoAttempt;
        const shouldRetry = isNonRetryableFailure
          ? false
          : await publishJobService.incrementRetry(
              job.id,
              1, // base delay minutes
              maxRetries
            );

        console.info(
          `[Queue] publish failed postId=${job.postId} safeError=${errorMessage ?? 'Unknown error'}`
        );
        if (shouldRetry) {
          if (
            errorCode === 'SIMULATION_RETRYABLE_FAILURE' &&
            !post.content.toLowerCase().includes('[simulated-retry-complete]')
          ) {
            await prisma.post.update({
              where: { id: job.postId },
              data: {
                content: `${post.content}\n[simulated-retry-complete]`,
                updatedAt: new Date(),
              },
            });
          }

          await notificationService.createNotification({
            type: 'warning',
            title: 'Publish retry scheduled',
            message: `Post #${job.postId} failed for account #${job.accountId} and will be retried. ${errorMessage ?? 'Unknown error'}`,
            relatedPostId: job.postId,
            relatedJobId: job.id,
          });

          logger.warn('[QueueService] Publish attempt failed and retry was scheduled', {
            jobId: job.id,
            postId: job.postId,
            accountId: job.accountId,
            attemptNumber,
            nextAttemptNumber: attemptNumber + 1,
            errorCode,
            errorMessage,
          });
        } else {
          // Non-retryable / max retries exceeded
          await publishJobService.updateJobStatus(job.id, 'failed', errorCode, errorMessage);
          
          // Update post target status
          await prisma.postTarget.updateMany({
            where: {
              postId: job.postId,
              accountId: job.accountId
            },
            data: {
              status: 'failed',
              errorMessage: errorMessage || 'Unknown error',
              updatedAt: new Date()
            }
          });

          const successfulTargets = await prisma.postTarget.count({
            where: {
              postId: job.postId,
              status: 'success',
            },
          });

          await prisma.post.update({
            where: { id: job.postId },
            data: {
              status: successfulTargets > 0
                ? 'partially_failed'
                : isBlockedFailure
                  ? 'blocked'
                  : 'failed',
              errorMessage: errorMessage || 'Unknown error',
              updatedAt: new Date(),
            },
          });

          await notificationService.createNotification({
            type: 'failure',
            title: 'Publish failed',
            message: `Post #${job.postId} failed permanently for account #${job.accountId}. ${errorMessage ?? 'Unknown error'}`,
            relatedPostId: job.postId,
            relatedJobId: job.id,
          });

          logger.warn('[QueueService] Publish attempt failed permanently', {
            jobId: job.id,
            postId: job.postId,
            accountId: job.accountId,
            attemptNumber,
            maxRetries,
            errorCode,
            errorMessage,
          });
        }
      }

      // Record the attempt
      await prisma.publishAttempt.create({
        data: {
          jobId: job.id,
          attemptNumber,
          status: success ? 'success' : 'failed',
          errorCode,
          errorMessage,
          responseData: responseData?.substring(0, 1000) // Limit response data size
        }
      });

    } catch (error: any) {
      logger.error('[QueueService] Unexpected error processing job', {
        jobId: job.id,
        postId: job.postId,
        accountId: job.accountId,
        attemptNumber,
        error,
      });
      
      const errorMsg = error?.message || 'Unknown error';
      
      // Still record the attempt
      try {
        await prisma.publishAttempt.create({
          data: {
            jobId: job.id,
            attemptNumber,
            status: 'failed',
            errorCode: 'PROCESSING_ERROR',
            errorMessage: errorMsg,
            responseData: JSON.stringify({ error: errorMsg }).substring(0, 1000)
          }
        });
      } catch (recordError) {
        logger.error(`[QueueService] Failed to record attempt for job ${job.id}`, { recordError });
      }

      // Try to mark job as failed
      try {
        await publishJobService.updateJobStatus(job.id, 'failed', 'PROCESSING_ERROR', errorMsg);
        await prisma.postTarget.updateMany({
          where: {
            postId: job.postId,
            accountId: job.accountId
          },
          data: {
            status: 'failed',
            errorMessage: errorMsg,
            updatedAt: new Date()
          }
        });
        await prisma.post.update({
          where: { id: job.postId },
          data: {
            status: 'failed',
            errorMessage: errorMsg,
            updatedAt: new Date(),
          },
        });
      } catch (updateError) {
        logger.error(`[QueueService] Failed to update job status for job ${job.id}`, { updateError });
      }
    }
  }


  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      const jobStats = await publishJobService.getJobStats();
      
      return {
        pending: jobStats.pending || 0,
        processing: jobStats.processing || 0,
        success: jobStats.success || 0,
        failed: jobStats.failed || 0,
        cancelled: jobStats.cancelled || 0,
        isProcessing: this.processing
      };
    } catch (error) {
      logger.error('[QueueService] Failed to get queue stats', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const queueService = new QueueService();