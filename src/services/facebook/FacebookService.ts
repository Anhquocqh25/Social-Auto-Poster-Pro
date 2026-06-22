import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { decrypt } from '@/lib/crypto';
import { OAuthConfig } from '@/types/oauth';
import { accountService } from '@/services/AccountService';
import { FacebookAuthProvider } from './FacebookAuthProvider';
import { FacebookMediaProvider } from './FacebookMediaProvider';
import { FacebookPageProvider } from './FacebookPageProvider';
import { FacebookPostProvider } from './FacebookPostProvider';
import { FacebookTokenProvider } from './FacebookTokenProvider';
import {
  FacebookAccountContext,
  FacebookPageSummary,
  FacebookPublishMode,
  FacebookPublishResult,
} from './FacebookProviderTypes';
import { FacebookValidationService } from './FacebookValidationService';
import {
  FACEBOOK_PAGE_READY_SCOPES,
  loadFacebookEnvConfig,
} from './FacebookConfigService';

export class FacebookService {
  readonly pageProvider: FacebookPageProvider;
  readonly mediaProvider: FacebookMediaProvider;
  readonly postProvider: FacebookPostProvider;

  constructor() {
    this.pageProvider = new FacebookPageProvider();
    this.mediaProvider = new FacebookMediaProvider();
    this.postProvider = new FacebookPostProvider();
  }

  private buildRuntimeDependencies(config?: Partial<OAuthConfig>) {
    const envConfig = loadFacebookEnvConfig();

    console.info('[Env] FACEBOOK_APP_ID present=%s', envConfig.appId ? 'true' : 'false');
    console.info('[Env] FACEBOOK_APP_SECRET present=%s', envConfig.appSecret ? 'true' : 'false');
    console.info(
      '[Env] FACEBOOK_REDIRECT_URI present=%s',
      envConfig.redirectUri ? 'true' : 'false'
    );
    console.info('[FacebookConfig] config valid=%s', envConfig.valid ? 'true' : 'false');

    const oauthConfig: OAuthConfig = {
      clientId: config?.clientId || envConfig.oauthConfig.clientId,
      clientSecret: config?.clientSecret || envConfig.oauthConfig.clientSecret,
      redirectUri: config?.redirectUri || envConfig.oauthConfig.redirectUri,
      scopes: config?.scopes || [...FACEBOOK_PAGE_READY_SCOPES],
    };

    const authProvider = new FacebookAuthProvider(oauthConfig);
    const tokenProvider = new FacebookTokenProvider(oauthConfig);
    const validationService = new FacebookValidationService(
      tokenProvider,
      this.pageProvider,
      this.mediaProvider
    );

    return {
      oauthConfig,
      authProvider,
      tokenProvider,
      validationService,
      configStatus: {
        isConfigured: envConfig.valid,
        errors: [...envConfig.errors],
      },
    };
  }

  getConfig(): OAuthConfig {
    return this.buildRuntimeDependencies().oauthConfig;
  }

  getConfigStatus(): { isConfigured: boolean; errors: string[] } {
    return this.buildRuntimeDependencies().configStatus;
  }

  async getAccountContext(accountId: number): Promise<FacebookAccountContext | null> {
    return this.buildRuntimeDependencies().validationService.buildAccountContext(accountId);
  }

  async getPagesForAccount(accountId: number): Promise<FacebookPageSummary[]> {
    const context = await this.getAccountContext(accountId);
    if (!context) {
      throw new Error('Facebook account context not found');
    }

    const pages = await this.pageProvider.fetchPages(context.accessToken);
    return this.pageProvider.enrichPagesWithPermissions(pages, context.accessToken);
  }

  async validateAccountPermissions(
    accountId: number,
    requiredPermissions: string[]
  ): Promise<{ ok: boolean; missing: string[]; pages: FacebookPageSummary[] }> {
    const pages = await this.getPagesForAccount(accountId);

    const permissions = pages[0]?.permissions ?? [];
    const result = this.pageProvider.validateRequiredPermissions(
      permissions,
      requiredPermissions
    );

    return {
      ok: result.ok,
      missing: result.missing,
      pages,
    };
  }

  private async resolveEncryptedPageToken(accountId: number, pageId: string) {
    const context = await this.getAccountContext(accountId);
    if (!context) {
      return null;
    }

    const pageTokenSetting = await prisma.platformSetting.findUnique({
      where: {
        accountId_settingKey: {
          accountId,
          settingKey: `facebook.pageToken.${pageId}`,
        },
      },
    });

    if (!pageTokenSetting?.settingValue) {
      return null;
    }

    return {
      context,
      pageAccessToken: decrypt(pageTokenSetting.settingValue),
    };
  }

  async publishForAccount(input: {
    accountId: number;
    pageId: string;
    pageAccessToken?: string;
    message?: string;
    mediaType?: 'photo' | 'video' | 'none';
    mediaUrl?: string;
    mediaLocalPath?: string;
    publishMode: FacebookPublishMode;
  }): Promise<FacebookPublishResult> {
    let context: FacebookAccountContext | null = null;
    let selectedPage: FacebookPageSummary | null = null;
    let resolvedPageToken = input.pageAccessToken;

    if (input.publishMode === 'simulation') {
      selectedPage = {
        id: input.pageId || `fb_sim_page_${input.accountId}`,
        name: 'Simulation Facebook Page',
        accessToken: input.pageAccessToken || 'simulation_page_token',
        permissions: FACEBOOK_PAGE_READY_SCOPES.map((permission) => ({
          permission,
          granted: true,
        })),
      };
      context = {
        accountId: input.accountId,
        platformAccountId: `fb_sim_account_${input.accountId}`,
        accessToken: 'simulation_access_token',
        accountName: 'Simulation Facebook Account',
        tokenExpiresAt: null,
      };
      resolvedPageToken = input.pageAccessToken || 'simulation_page_token';
    } else {
      const facebookEnv = loadFacebookEnvConfig();

      if (!facebookEnv.realPublishingEnabled) {
        return {
          success: false,
          errorCode: 'FACEBOOK_REAL_PUBLISH_DISABLED',
          errorMessage: 'Real Facebook publishing is disabled by feature flag.',
          rawResponse: {
            blockedReason: 'real_publishing_disabled',
            pageIdMasked: input.pageId ? `${input.pageId.slice(0, 2)}••••${input.pageId.slice(-4)}` : null,
          },
          mode: input.publishMode,
        };
      }

      const runtimeDependencies = this.buildRuntimeDependencies();

      if (!runtimeDependencies.configStatus.isConfigured) {
        return {
          success: false,
          errorCode: 'FACEBOOK_CONFIG_INVALID',
          errorMessage: `Facebook configuration is incomplete: ${runtimeDependencies.configStatus.errors.join('; ')}`,
          rawResponse: {
            configErrors: runtimeDependencies.configStatus.errors,
          },
          mode: input.publishMode,
        };
      }

      const resolvedTarget = await this.resolveEncryptedPageToken(input.accountId, input.pageId);
      if (!resolvedTarget) {
        return {
          success: false,
          errorCode: 'FACEBOOK_PAGE_TOKEN_MISSING',
          errorMessage: 'Encrypted Facebook Page token is unavailable for this target.',
          rawResponse: {
            blockedReason: 'missing_page_access_token',
          },
          mode: input.publishMode,
        };
      }

      context = resolvedTarget.context;
      resolvedPageToken = resolvedTarget.pageAccessToken;

      const pages = await this.getPagesForAccount(input.accountId);
      selectedPage = pages.find((page) => page.id === input.pageId) ?? null;
    }

    const runtimeDependencies = this.buildRuntimeDependencies();
    const validation = await runtimeDependencies.validationService.validateBeforePublish({
      account: context,
      selectedPage,
      message: input.message,
      mediaType: input.mediaType,
      mediaUrl: input.mediaUrl,
      mediaLocalPath: input.mediaLocalPath,
      requiredPermissions: [...FACEBOOK_PAGE_READY_SCOPES],
    });

    if (!validation.ok) {
      return {
        success: false,
        errorCode: 'FACEBOOK_VALIDATION_FAILED',
        errorMessage: validation.errors.join('; '),
        rawResponse: {
          errors: validation.errors,
          warnings: validation.warnings,
        },
        mode: input.publishMode,
      };
    }

    logger.info('[FacebookService] Publishing via Facebook provider', {
      accountId: input.accountId,
      pageId: input.pageId,
      mediaType: input.mediaType ?? 'none',
      publishMode: input.publishMode,
    });
    console.info(
      `[FacebookService] publishForAccount mediaType=${input.mediaType ?? 'none'} hasMediaLocalPath=${input.mediaLocalPath ? 'true' : 'false'}`
    );

    if (
      input.publishMode === 'real' &&
      (input.mediaType ?? 'none') === 'photo' &&
      input.mediaUrl &&
      input.mediaUrl.includes(',')
    ) {
      return {
        success: false,
        errorCode: 'UNSUPPORTED_MULTIPLE_IMAGES_FOR_REAL_PUBLISH',
        errorMessage: 'Multiple image publishing is not enabled in this phase.',
        rawResponse: {
          blockedReason: 'multiple_images_not_enabled',
        },
        mode: input.publishMode,
      };
    }

    if (
      input.publishMode === 'real' &&
      (input.mediaType ?? 'none') === 'video' &&
      input.mediaUrl &&
      !input.mediaLocalPath
    ) {
      return {
        success: false,
        errorCode: 'FACEBOOK_REAL_VIDEO_LOCAL_FILE_REQUIRED',
        errorMessage: 'Real Facebook video upload requires one local video file.',
        rawResponse: {
          blockedReason: 'real_video_local_file_required',
        },
        mode: input.publishMode,
        finalState: 'failed',
      };
    }

    switch (input.mediaType ?? 'none') {
      case 'photo':
        return this.postProvider.publishImage({
          pageId: input.pageId,
          pageAccessToken: resolvedPageToken,
          message: input.message,
          mediaType: 'photo',
          mediaUrl: input.mediaUrl,
          mediaLocalPath: input.mediaLocalPath,
          publishMode: input.publishMode,
        });
      case 'video':
        return this.postProvider.publishVideo({
          pageId: input.pageId,
          pageAccessToken: resolvedPageToken,
          message: input.message,
          mediaType: 'video',
          mediaUrl: input.mediaUrl,
          mediaLocalPath: input.mediaLocalPath,
          publishMode: input.publishMode,
        });
      case 'none':
      default:
        return this.postProvider.publishText({
          pageId: input.pageId,
          pageAccessToken: resolvedPageToken,
          message: input.message,
          mediaType: 'none',
          publishMode: input.publishMode,
        });
    }
  }

  async disconnectAccount(accountId: number): Promise<void> {
    const accessToken = await accountService.getAccessToken(accountId);
    if (accessToken) {
      await this.buildRuntimeDependencies().authProvider.revoke(accessToken);
    }
    await accountService.deleteAccount(accountId);
  }
}

export const facebookService = new FacebookService();