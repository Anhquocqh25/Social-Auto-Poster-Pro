import axios from 'axios';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';
import { OAuthConfig, OAuthError } from '@/types/oauth';
import { IFacebookAuthProvider } from './FacebookProviderTypes';

export class FacebookAuthProvider implements IFacebookAuthProvider {
  private readonly authEndpoint = 'https://www.facebook.com/v18.0/dialog/oauth';
  private readonly tokenEndpoint = 'https://graph.facebook.com/v18.0/oauth/access_token';

  constructor(private readonly config: OAuthConfig) {}

  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const url = new URL(this.authEndpoint);
    url.searchParams.set('client_id', this.config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('scope', this.config.scopes.join(','));
    url.searchParams.set('response_type', 'code');

    logger.info('[FacebookAuthProvider] Authorization URL generated');
    return url.toString();
  }

  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | null;
    scope?: string;
    tokenType: string;
  }> {
    try {
      const params = new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        code,
      });

      if (codeVerifier) {
        params.set('code_verifier', codeVerifier);
      }

      const response = await axios.get(this.tokenEndpoint, { params });

      const data = response.data as {
        access_token: string;
        token_type?: string;
        expires_in?: number;
      };

      return {
        accessToken: data.access_token,
        tokenType: data.token_type ?? 'Bearer',
        expiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : null,
      };
    } catch (error) {
      logger.error('[FacebookAuthProvider] Token exchange failed', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError('Facebook token exchange failed', 'FACEBOOK_TOKEN_EXCHANGE_FAILED', 'facebook');
    }
  }

  async revoke(accessToken: string): Promise<void> {
    try {
      await axios.delete('https://graph.facebook.com/v18.0/me/permissions', {
        params: {
          access_token: accessToken,
        },
      });
      logger.info('[FacebookAuthProvider] Token revoked');
    } catch (error) {
      logger.error('[FacebookAuthProvider] Token revoke failed', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError('Facebook token revoke failed', 'FACEBOOK_TOKEN_REVOKE_FAILED', 'facebook');
    }
  }

  validateState(state: string, expectedState: string): boolean {
    const isValid = !!state && !!expectedState && state === expectedState;
    if (!isValid) {
      logger.warn('[FacebookAuthProvider] OAuth state validation failed');
    }
    return isValid;
  }
}