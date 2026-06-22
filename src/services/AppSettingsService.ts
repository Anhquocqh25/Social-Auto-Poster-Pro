import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

/**
 * App Settings Service
 * Manages application-wide settings including scheduler configuration
 */
export class AppSettingsService {
  // Default scheduler settings
  private readonly DEFAULT_SETTINGS = {
    schedulerInterval: '1', // minutes
    autoPostingEnabled: 'true',
    maxRetryAttempts: '3',
    baseRetryDelay: '1', // minutes
    notificationEnabled: 'true',
    logRetentionDays: '30',
    simulationMode: 'true'
  };

  private isMissingAppSettingsTable(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2021'
    );
  }

  /**
   * Get a setting by key
   */
  async getSetting(key: string): Promise<string | null> {
    try {
      const setting = await prisma.appSetting.findUnique({
        where: { key }
      });
      
      return setting?.value ?? null;
    } catch (error) {
      if (this.isMissingAppSettingsTable(error)) {
        logger.warn(`[AppSettingsService] AppSetting table missing; using fallback for ${key}`);
        return this.DEFAULT_SETTINGS[key as keyof typeof this.DEFAULT_SETTINGS] ?? null;
      }
      logger.error(`[AppSettingsService] Failed to get setting ${key}`, { error });
      throw error;
    }
  }
  
  /**
   * Set a setting value
   */
  async setSetting(key: string, value: string, description?: string): Promise<any> {
    try {
      const setting = await prisma.appSetting.upsert({
        where: { key },
        update: { value, description, updatedAt: new Date() },
        create: { key, value, description }
      });
      
      logger.info(`[AppSettingsService] Setting updated: ${key} = ${value}`);
      return setting;
    } catch (error) {
      logger.error(`[AppSettingsService] Failed to set setting ${key}`, { error });
      throw error;
    }
  }
  
  /**
   * Get multiple settings at once
   */
  async getSettings(keys: string[]): Promise<Record<string, string>> {
    try {
      const settings = await prisma.appSetting.findMany({
        where: {
          key: {
            in: keys
          }
        }
      });
      
      const result: Record<string, string> = {};
      // Fill with defaults first
      for (const [key, value] of Object.entries(this.DEFAULT_SETTINGS)) {
        result[key] = value;
      }
      // Override with actual values
      for (const setting of settings) {
        result[setting.key] = setting.value;
      }
      
      return result;
    } catch (error) {
      if (this.isMissingAppSettingsTable(error)) {
        logger.warn('[AppSettingsService] AppSetting table missing; using in-memory default settings');
        return { ...this.DEFAULT_SETTINGS };
      }
      logger.error('[AppSettingsService] Failed to get settings', { error });
      throw error;
    }
  }
  
  /**
   * Get scheduler-specific settings
   */
  async getSchedulerSettings(): Promise<{
    interval: number; // minutes
    autoPostingEnabled: boolean;
    maxRetryAttempts: number;
    baseRetryDelay: number; // minutes
    notificationEnabled: boolean;
    logRetentionDays: number;
    simulationMode: boolean;
  }> {
    try {
      const settings = await this.getSettings([
        'schedulerInterval',
        'autoPostingEnabled',
        'maxRetryAttempts',
        'baseRetryDelay',
        'notificationEnabled',
        'logRetentionDays',
        'simulationMode'
      ]);
      
      return {
        interval: parseInt(settings.schedulerInterval || this.DEFAULT_SETTINGS.schedulerInterval),
        autoPostingEnabled: settings.autoPostingEnabled?.toLowerCase() === 'true',
        maxRetryAttempts: parseInt(settings.maxRetryAttempts || this.DEFAULT_SETTINGS.maxRetryAttempts),
        baseRetryDelay: parseInt(settings.baseRetryDelay || this.DEFAULT_SETTINGS.baseRetryDelay),
        notificationEnabled: settings.notificationEnabled?.toLowerCase() === 'true',
        logRetentionDays: parseInt(settings.logRetentionDays || this.DEFAULT_SETTINGS.logRetentionDays),
        simulationMode: settings.simulationMode?.toLowerCase() === 'true'
      };
    } catch (error) {
      logger.error('[AppSettingsService] Failed to get scheduler settings', { error });
      throw error;
    }
  }
  
  /**
   * Update scheduler settings
   */
  async updateSchedulerSettings(settings: {
    interval?: number;
    autoPostingEnabled?: boolean;
    maxRetryAttempts?: number;
    baseRetryDelay?: number;
    notificationEnabled?: boolean;
    logRetentionDays?: number;
    simulationMode?: boolean;
  }): Promise<void> {
    try {
      const updates: Array<Promise<any>> = [];
      
      if (settings.interval !== undefined) {
        updates.push(this.setSetting('schedulerInterval', settings.interval.toString(), 'Scheduler interval in minutes'));
      }
      if (settings.autoPostingEnabled !== undefined) {
        updates.push(this.setSetting('autoPostingEnabled', settings.autoPostingEnabled.toString(), 'Enable/disable auto posting'));
      }
      if (settings.maxRetryAttempts !== undefined) {
        updates.push(this.setSetting('maxRetryAttempts', settings.maxRetryAttempts.toString(), 'Maximum retry attempts for failed jobs'));
      }
      if (settings.baseRetryDelay !== undefined) {
        updates.push(this.setSetting('baseRetryDelay', settings.baseRetryDelay.toString(), 'Base delay between retries in minutes'));
      }
      if (settings.notificationEnabled !== undefined) {
        updates.push(this.setSetting('notificationEnabled', settings.notificationEnabled.toString(), 'Enable/disable notifications'));
      }
      if (settings.logRetentionDays !== undefined) {
        updates.push(this.setSetting('logRetentionDays', settings.logRetentionDays.toString(), 'Number of days to keep logs'));
      }
      if (settings.simulationMode !== undefined) {
        updates.push(this.setSetting('simulationMode', settings.simulationMode.toString(), 'Enable/disable local simulation mode'));
      }
      
      await Promise.all(updates);
      logger.info('[AppSettingsService] Scheduler settings updated');
    } catch (error) {
      if (this.isMissingAppSettingsTable(error)) {
        logger.warn('[AppSettingsService] AppSetting table missing; scheduler settings update skipped');
        return;
      }
      logger.error('[AppSettingsService] Failed to update scheduler settings', { error });
      throw error;
    }
  }
  
  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    try {
      // Delete all settings
      await prisma.appSetting.deleteMany({});
      
      // Recreate defaults
      const defaultSettings = Object.entries(this.DEFAULT_SETTINGS).map(([key, value]) => ({
        key,
        value,
        description: `Default value for ${key}`
      }));
      
      await prisma.appSetting.createMany({
        data: defaultSettings
      });
      
      logger.info('[AppSettingsService] Settings reset to defaults');
    } catch (error) {
      if (this.isMissingAppSettingsTable(error)) {
        logger.warn('[AppSettingsService] AppSetting table missing; resetToDefaults skipped');
        return;
      }
      logger.error('[AppSettingsService] Failed to reset settings to defaults', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const appSettingsService = new AppSettingsService();