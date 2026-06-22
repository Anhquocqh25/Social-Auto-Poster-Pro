import axios from 'axios';
import { BaseOAuthProvider } from './BaseOAuthProvider';
import {
  OAuthConfig,
  OAuthUserInfo,
  PlatformType,
  OAuthError,
} from '@/types/oauth';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';
import { FACEBOOK_DEFAULT_GRAPH_API_VERSION } from '@/services/facebook/FacebookConfigService';

/**
 * Facebook OAuth Provider
 * Real Facebook Graph API foundation for OAuth/account connection only.
 * Real publishing remains handled separately and is intentionally not enabled here.
 */
export class FacebookOAuthProvider extends BaseOAuthProvider {
  readonly platform: PlatformType = 'facebook';
  readonly name = 'Facebook';

  private readonly graphApiVersion: string;
  protected authEndpoint: string;
  protected tokenEndpoint: string;
  protected userInfoEndpoint: string;
  protected revokeEndpoint: string;

  constructor(config: OAuthConfig, graphApiVersion = FACEBOOK_DEFAULT_GRAPH_API_VERSION) {
    super(config);
    this.graphApiVersion = graphApiVersion;
    this.authEndpoint = `https://www.facebook.com/${this.graphApiVersion}/dialog/oauth`;
    this.tokenEndpoint = `https://graph.facebook.com/${this.graphApiVersion}/oauth/access_token`;
    this.userInfoEndpoint = `https://graph.facebook.com/${this.graphApiVersion}/me`;
    this.revokeEndpoint = `https://graph.facebook.com/${this.graphApiVersion}/me/permissions`;

    logger.info('[Facebook] OAuth provider initialized', {
      graphApiVersion: this.graphApiVersion,
    });
  }

  async getAuthorizationUrl(
    state: string,
    redirectUri: string,
    codeChallenge?: string
  ): Promise<string> {
    logger.info('[Facebook] Generating authorization URL', {
      redirectUri,
      hasCodeChallenge: !!codeChallenge,
    });

    const params: Record<string, string> = {
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.config.scopes.join(','),
      response_type: 'code',
    };

    if (codeChallenge) {
      params.code_challenge = codeChallenge;
      params.code_challenge_method = 'S256';
    }

    return this.buildAuthUrl(this.authEndpoint, params);
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const response = await axios.get<{
        id: string;
        name: string;
        email?: string;
        picture?: {
          data?: {
            url?: string;
          };
        };
      }>(this.userInfoEndpoint, {
        params: {
          access_token: accessToken,
          fields: 'id,name,email,picture{url}',
        },
        timeout: 15000,
      });

      return {
        id: response.data.id,
        name: response.data.name,
        email: response.data.email,
        avatarUrl: response.data.picture?.data?.url,
        platform: 'facebook',
      };
    } catch (error) {
      logger.error('[Facebook] Failed to fetch user info', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError(
        'Failed to fetch Facebook user profile',
        'FACEBOOK_USER_INFO_FAILED',
        'facebook'
      );
    }
  }

  async getPages(accessToken: string): Promise<
    Array<{
      id: string;
      name: string;
      access_token: string;
      category?: string;
    }>
  > {
    try {
      const response = await axios.get<{
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          category?: string;
        }>;
      }>(`https://graph.facebook.com/${this.graphApiVersion}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,access_token,category',
        },
        timeout: 15000,
      });

      return response.data.data ?? [];
    } catch (error) {
      logger.error('[Facebook] Failed to fetch pages', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError(
        'Failed to fetch manageable Facebook pages',
        'FACEBOOK_PAGE_FETCH_FAILED',
        'facebook'
      );
    }
  }
}