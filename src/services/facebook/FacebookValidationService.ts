import { accountService } from '@/services/AccountService';
import { FacebookMediaProvider } from './FacebookMediaProvider';
import { FacebookPageProvider } from './FacebookPageProvider';
import { FacebookTokenProvider } from './FacebookTokenProvider';
import { FacebookAccountContext, FacebookPageSummary } from './FacebookProviderTypes';

export interface FacebookPublishValidationInput {
  account: FacebookAccountContext | null;
  selectedPage: FacebookPageSummary | null;
  message?: string;
  mediaType?: 'photo' | 'video' | 'none';
  mediaUrl?: string;
  mediaLocalPath?: string;
  requiredPermissions: string[];
}

export interface FacebookPublishValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export class FacebookValidationService {
  constructor(
    private readonly tokenProvider: FacebookTokenProvider,
    private readonly pageProvider: FacebookPageProvider,
    private readonly mediaProvider: FacebookMediaProvider
  ) {}

  async validateBeforePublish(
    input: FacebookPublishValidationInput
  ): Promise<FacebookPublishValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!input.account) {
      errors.push('Facebook account is not connected');
      return { ok: false, errors, warnings };
    }

    if (!input.selectedPage) {
      errors.push('No Facebook page is selected');
    }

    if (!input.message?.trim() && (input.mediaType ?? 'none') === 'none') {
      errors.push('Post must contain text or media');
    }

    const tokenExpired =
      input.account.tokenExpiresAt
        ? this.tokenProvider.isExpired(input.account.tokenExpiresAt)
        : false;

    if (tokenExpired) {
      errors.push('Facebook access token is expired');
    }

    const isSimulationContext =
      input.account.platformAccountId.startsWith('fb_sim_') ||
      input.account.accessToken === 'simulation_access_token';

    if (!isSimulationContext) {
      const tokenValid = await this.tokenProvider.validateAccessToken(input.account.accessToken);
      if (!tokenValid) {
        errors.push('Facebook access token is invalid');
      }
    }

    const mediaValidation = await this.mediaProvider.validateMedia({
      mediaType: input.mediaType,
      mediaUrl: input.mediaUrl,
      mediaLocalPath: input.mediaLocalPath,
    });

    if (!mediaValidation.ok) {
      errors.push(mediaValidation.error ?? 'Media validation failed');
    }

    if (input.selectedPage) {
      const permissions = input.selectedPage.permissions ?? [];
      const permissionResult = this.pageProvider.validateRequiredPermissions(
        permissions,
        input.requiredPermissions
      );

      if (!permissionResult.ok) {
        errors.push(
          `Missing Facebook permissions: ${permissionResult.missing.join(', ')}`
        );
      }
    }

    if (input.mediaType === 'video' && !input.mediaUrl && !input.mediaLocalPath) {
      warnings.push('Video post selected without a confirmed media source');
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
    };
  }

  async buildAccountContext(accountId: number): Promise<FacebookAccountContext | null> {
    const account = await accountService.getAccount(accountId);
    if (!account) {
      return null;
    }

    const accessToken = await accountService.getAccessToken(accountId);
    if (!accessToken) {
      return null;
    }

    return {
      accountId: account.id,
      platformAccountId: account.accountId,
      accountName: account.accountName,
      accessToken,
      tokenExpiresAt: account.tokenExpiresAt ?? null,
    };
  }
}