import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Job Lock Service
 * Prevents duplicate processing of jobs and handles stale locks
 */
export class JobLockService {
  private readonly LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  private readonly STALE_LOCK_CHECK_INTERVAL = 60 * 1000; // 1 minute

  /**
   * Try to acquire a lock for a post
   * @param postId The post ID to lock
   * @param lockIdentifier Unique identifier for the lock holder (e.g., process ID)
   * @returns True if lock was acquired, false if already locked
   */
  async acquireLock(postId: number, lockIdentifier: string): Promise<boolean> {
    try {
      const now = new Date();
      const lockExpiry = new Date(now.getTime() + this.LOCK_TIMEOUT_MS);

      // Try to update a post that is not currently locked
      const result = await prisma.post.updateMany({
        where: {
          id: postId,
          OR: [
            { lockedAt: null },
            { lockedAt: { lt: now } } // Lock is expired
          ]
        },
        data: {
          lockedAt: lockExpiry,
          lockedBy: lockIdentifier,
          updatedAt: now
        }
      });

      const locked = result.count > 0;
      if (locked) {
        logger.info(`[JobLockService] Lock acquired for post ${postId} by ${lockIdentifier}`);
      } else {
        logger.debug(`[JobLockService] Lock failed for post ${postId} - already locked`);
      }

      return locked;
    } catch (error) {
      logger.error(`[JobLockService] Failed to acquire lock for post ${postId}`, { error });
      return false;
    }
  }

  /**
   * Release a lock for a post
   * @param postId The post ID to unlock
   * @param lockIdentifier The lock holder identifier (for verification)
   * @returns True if lock was released, false if not locked by this holder
   */
  async releaseLock(postId: number, lockIdentifier: string): Promise<boolean> {
    try {
      const result = await prisma.post.updateMany({
        where: {
          id: postId,
          lockedBy: lockIdentifier
        },
        data: {
          lockedAt: null,
          lockedBy: null,
          updatedAt: new Date()
        }
      });

      const released = result.count > 0;
      if (released) {
        logger.info(`[JobLockService] Lock released for post ${postId} by ${lockIdentifier}`);
      } else {
 logger.debug(`[JobLockService] Lock release failed for post ${postId} - not locked by ${lockIdentifier}`);
      }

      return released;
    } catch (error) {
      logger.error(`[JobLockService] Failed to release lock for post ${postId}`, { error });
      return false;
    }
  }

  /**
   * Check if a post is currently locked
   * @param postId The post ID to check
   * @returns Object with lock status and holder info
   */
  async getLockStatus(postId: number): Promise<{
    isLocked: boolean;
    lockedBy: string | null;
    lockedAt: Date | null;
    expiresAt: Date | null;
  }> {
    try {
      const post = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          lockedAt: true,
          lockedBy: true
        }
      });

      if (!post) {
        return {
          isLocked: false,
          lockedBy: null,
          lockedAt: null,
          expiresAt: null
        };
      }

      const isLocked = !!post.lockedAt && post.lockedAt > new Date();
      return {
        isLocked,
        lockedBy: post.lockedBy,
        lockedAt: post.lockedAt,
        expiresAt: post.lockedAt
      };
    } catch (error) {
      logger.error(`[JobLockService] Failed to get lock status for post ${postId}`, { error });
      return {
        isLocked: false,
        lockedBy: null,
        lockedAt: null,
        expiresAt: null
      };
    }
  }

  /**
   * Release all expired locks (called periodically)
   */
  async releaseExpiredLocks(): Promise<number> {
    try {
      const now = new Date();
      const result = await prisma.post.updateMany({
        where: {
          lockedAt: {
            lt: now
          }
        },
        data: {
          lockedAt: null,
          lockedBy: null,
          updatedAt: now
        }
      });

      const released = result.count;
      if (released > 0) {
        logger.info(`[JobLockService] Released ${released} expired locks`);
      }

      return released;
    } catch (error) {
      logger.error('[JobLockService] Failed to release expired locks', { error });
      return 0;
    }
  }

  /**
   * Start background task to clean up stale locks
   */
  startStaleLockCleanup(): NodeJS.Timeout {
    return setInterval(async () => {
      try {
        await this.releaseExpiredLocks();
      } catch (error) {
        logger.error('[JobLockService] Stale lock cleanup error', { error });
      }
    }, this.STALE_LOCK_CHECK_INTERVAL);
  }
}

// Export singleton instance
export const jobLockService = new JobLockService();