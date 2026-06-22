import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * Notification Service
 * Manages in-app and desktop notifications
 */
export class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(options: {
    type: 'success' | 'failure' | 'warning' | 'info';
    title: string;
    message: string;
    relatedPostId?: number;
    relatedJobId?: number;
  }): Promise<any> {
    try {
      const notification = await prisma.notification.create({
        data: {
          type: options.type,
          title: options.title,
          message: options.message,
          relatedPostId: options.relatedPostId,
          relatedJobId: options.relatedJobId,
        }
      });
      
      logger.info('[NotificationService] Notification created', { 
        id: notification.id, 
        type: notification.type 
      });
      
      // TODO: Trigger desktop notification here (requires Electron main process)
      // This would be implemented via IPC to main process
      
      return notification;
    } catch (error) {
      logger.error('[NotificationService] Failed to create notification', { error });
      throw error;
    }
  }
  
  /**
   * Get unread notifications
   */
  async getUnreadNotifications(limit: number = 50): Promise<any[]> {
    try {
      const notifications = await prisma.notification.findMany({
        where: {
          isRead: false
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });
      
      return notifications;
    } catch (error) {
      logger.error('[NotificationService] Failed to get unread notifications', { error });
      throw error;
    }
  }
  
  /**
   * Get all notifications with pagination
   */
  async getNotifications(options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}): Promise<{
    notifications: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const page = options.page ?? 1;
      const limit = options.limit ?? 20;
      const skip = (page - 1) * limit;
      
      const where = options.unreadOnly ? { isRead: false } : {};
      
      const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.notification.count({ where })
      ]);
      
      return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      logger.error('[NotificationService] Failed to get notifications', { error });
      throw error;
    }
  }
  
  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: number): Promise<boolean> {
    try {
      const result = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
      });
      
      return !!result;
    } catch (error) {
      logger.error('[NotificationService] Failed to mark notification as read', { error });
      return false;
    }
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    try {
      const result = await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true }
      });
      
      return result.count;
    } catch (error) {
      logger.error('[NotificationService] Failed to mark all notifications as read', { error });
      return 0;
    }
  }
  
  /**
   * Delete a single notification
   */
  async deleteNotification(notificationId: number): Promise<boolean> {
    try {
      await prisma.notification.delete({
        where: { id: notificationId }
      });

      return true;
    } catch (error) {
      logger.error('[NotificationService] Failed to delete notification', { notificationId, error });
      return false;
    }
  }

  /**
   * Delete all notifications
   */
  async clearAllNotifications(): Promise<number> {
    try {
      const result = await prisma.notification.deleteMany({});
      return result.count;
    } catch (error) {
      logger.error('[NotificationService] Failed to clear all notifications', { error });
      return 0;
    }
  }

  /**
   * Delete old notifications
   */
  async deleteOldNotifications(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });
      
      logger.info('[NotificationService] Deleted old notifications', { count: result.count });
      return result.count;
    } catch (error) {
      logger.error('[NotificationService] Failed to delete old notifications', { error });
      return 0;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();