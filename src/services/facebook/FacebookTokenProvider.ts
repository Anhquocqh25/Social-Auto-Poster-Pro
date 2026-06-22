import axios from 'axios';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';
import { OAuthConfig, OAuthError } from '@/types/oauth';
import { IFacebookTokenProvider } from './FacebookProviderTypes';

export class FacebookTokenProvider implements IFacebookTokenProvider {
  private readonly tokenEndpoint = 'https://graph.facebook.com/v18.0/oauth/access_token';
  private readonly debugTokenEndpoint = 'https://graph.facebook.com/debug_token';
  private readonly refreshThresholdMinutes = 15;

  constructor(private readonly config: OAuthConfig) {}

  isExpired(expiresAt?: Date | null): boolean {
    if (!expiresAt) {
      return false;
    }

    return expiresAt.getTime() <= Date.now();
  }

  shouldRefresh(expiresAt?: Date | null, thresholdMinutes = this.refreshThresholdMinutes): boolean {
    if (!expiresAt) {
      return false;
    }

    const thresholdMs = thresholdMinutes * 60 * 1000;
    return expiresAt.getTime() - Date.now() <= thresholdMs;
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | null;
    scope?: string;
    tokenType: string;
  }> {
    try {
      const params = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        fb_exchange_token: refreshToken,
      });

      const response = await axios.get(this.tokenEndpoint, { params });
      const data = response.data as {
        access_token: string;
        token_type?: string;
        expires_in?: number;
      };

      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'Bearer',
        refreshToken,
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
      };
    } catch (error) {
      logger.error('[FacebookTokenProvider] Token refresh failed', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError('Facebook token refresh failed', 'FACEBOOK_TOKEN_REFRESH_FAILED', 'facebook');
    }
  }

  async validateAccessToken(accessToken: string): Promise<boolean> {
    try {
      const appToken = `${this.config.clientId}|${this.config.clientSecret}`;

      const response = await axios.get(this.debugTokenEndpoint, {
        params: {
          input_token: accessToken,
          access_token: appToken,
        },
      });

      const data = response.data as {
        data?: {
          is_valid?: boolean;
          expires_at?: number;
        };
      };

      return !!data.data?.is_valid;
    } catch (error) {
      logger.error('[FacebookTokenProvider] Token validation failed', {
        error: sanitizeForLog(error),
      });
      return false;
    }
  }
}