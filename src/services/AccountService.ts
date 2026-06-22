import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { PlatformType } from '@/types/oauth';

/**
 * Account Service
 * Manages social media accounts and their tokens
 */
export class AccountService {
  /**
   * Get all connected accounts
   */
  async getAccounts() {
    try {
      const accounts = await prisma.account.findMany({
        orderBy: { createdAt: 'desc' },
      });
      
      return accounts.map(account => ({
        id: account.id,
        platform: account.platform as PlatformType,
        accountId: account.accountId,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
        tokenExpiresAt: account.tokenExpiresAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      }));
    } catch (error) {
      logger.error('[AccountService] Failed to get accounts', { error });
      throw error;
    }
  }
  
  /**
   * Get account by ID
   */
  async getAccount(id: number) {
    try {
      const account = await prisma.account.findUnique({
        where: { id },
      });
      
      if (!account) {
        return null;
      }
      
      return {
        id: account.id,
        platform: account.platform as PlatformType,
        accountId: account.accountId,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
        tokenExpiresAt: account.tokenExpiresAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        hasToken: false, // We don't have the token info in this query
      };
    } catch (error) {
      logger.error('[AccountService] Failed to get account', { id, error });
      throw error;
    }
  }
  
  /**
   * Get decrypted access token for an account
   */
  async getAccessToken(accountId: number): Promise<string | null> {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { accessToken: true },
      });
      
      if (!account || !account.accessToken) {
        return null;
      }
      
      return decrypt(account.accessToken);
    } catch (error) {
      logger.error('[AccountService] Failed to get access token', { accountId, error });
      throw error;
    }
  }
  
  /**
   * Delete an account
   */
  async deleteAccount(id: number) {
    try {
      // Delete platform token first (due to foreign key)
      await prisma.platformToken.deleteMany({
        where: { accountId: id },
      });
      
      // Delete account
      await prisma.account.delete({
        where: { id },
      });
      
      logger.info('[AccountService] Account deleted', { id });
      return true;
    } catch (error) {
      logger.error('[AccountService] Failed to delete account', { id, error });
      throw error;
    }
  }
  
  /**
   * Get accounts by platform
   */
  async getAccountsByPlatform(platform: PlatformType) {
    try {
      const accounts = await prisma.account.findMany({
        where: { platform },
        orderBy: { createdAt: 'desc' },
      });
      
      return accounts.map(account => ({
        id: account.id,
        accountId: account.accountId,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
      }));
    } catch (error) {
      logger.error('[AccountService] Failed to get accounts by platform', { platform, error });
      throw error;
    }
  }
  
  /**
   * Get active accounts count by platform
   */
  async getAccountStats() {
    try {
      const accounts = await prisma.account.groupBy({
        by: ['platform', 'status'],
        _count: true,
      });
      
      const stats: Record<string, { active: number; expired: number; error: number }> = {};
      
      accounts.forEach(({ platform, status, _count }) => {
        if (!stats[platform]) {
          stats[platform] = { active: 0, expired: 0, error: 0 };
        }
        stats[platform][status as keyof typeof stats[typeof platform]] = _count;
      });
      
      return stats;
    } catch (error) {
      logger.error('[AccountService] Failed to get account stats', { error });
      throw error;
    }
  }
  
  /**
   * Update account status
   */
  async updateAccountStatus(id: number, status: 'active' | 'expired' | 'error') {
    try {
      await prisma.account.update({
        where: { id },
        data: { status, updatedAt: new Date() },
      });
      
      logger.info('[AccountService] Account status updated', { id, status });
    } catch (error) {
      logger.error('[AccountService] Failed to update account status', { id, status, error });
      throw error;
    }
  }
  
  /**
   * Check if account token is expired
   */
  async isTokenExpired(accountId: number): Promise<boolean> {
    try {
      const account = await prisma.account.findUnique({
        where: { id: accountId },
        select: { tokenExpiresAt: true },
      });
      
      if (!account || !account.tokenExpiresAt) {
        return false; // No expiration date means token doesn't expire
      }
      
      return account.tokenExpiresAt < new Date();
    } catch (error) {
      logger.error('[AccountService] Failed to check token expiration', { accountId, error });
      throw error;
    }
  }
  
  /**
   * Get accounts that need token refresh
   */
  async getAccountsNeedingRefresh() {
    try {
      const now = new Date();
      const refreshThreshold = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      
      const accounts = await prisma.account.findMany({
        where: {
          refreshToken: { not: null },
          tokenExpiresAt: { lte: refreshThreshold },
          status: 'active',
        },
      });
      
      return accounts.map(account => ({
        id: account.id,
        platform: account.platform as PlatformType,
        accountName: account.accountName,
        tokenExpiresAt: account.tokenExpiresAt,
      }));
    } catch (error) {
      logger.error('[AccountService] Failed to get accounts needing refresh', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const accountService = new AccountService();