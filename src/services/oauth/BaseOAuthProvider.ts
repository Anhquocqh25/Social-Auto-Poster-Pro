import axios, { AxiosError } from 'axios';
import {
  IOAuthProvider,
  OAuthConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
  PlatformType,
  OAuthError,
  TokenExpiredError,
  InvalidTokenError,
  RateLimitError,
} from '@/types/oauth';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';

/**
 * Base OAuth Provider
 * Provides common OAuth 2.0 functionality for all platforms
 */
export abstract class BaseOAuthProvider implements IOAuthProvider {
  abstract readonly platform: PlatformType;
  abstract readonly name: string;
  
  protected config: OAuthConfig;
  
  // Platform-specific OAuth endpoints
  protected abstract authEndpoint: string;
  protected abstract tokenEndpoint: string;
  protected abstract userInfoEndpoint: string;
  protected abstract revokeEndpoint?: string;
  
  constructor(config: OAuthConfig) {
    this.config = config;
  }
  
  /**
   * Build authorization URL with query parameters
   */
  protected buildAuthUrl(baseUrl: string, params: Record<string, string>): string {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    return url.toString();
  }
  
  /**
   * Generate OAuth authorization URL
   * Must be implemented by each platform
   */
  abstract getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;
  
  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });
      
      if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
      }
      
      logger.info(`[${this.platform}] Exchanging code for token`, {
        redirectUri,
        hasCodeVerifier: !!codeVerifier,
      });
      
      const response = await axios.post<OAuthTokenResponse>(
        this.tokenEndpoint,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      logger.info(`[${this.platform}] Token exchange successful`);
      return response.data;
    } catch (error) {
      return this.handleOAuthError(error, 'Token exchange failed');
    }
  }
  
  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      logger.info(`[${this.platform}] Refreshing access token`);
      
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });
      
      const response = await axios.post<OAuthTokenResponse>(
        this.tokenEndpoint,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      logger.info(`[${this.platform}] Token refresh successful`);
      return response.data;
    } catch (error) {
      return this.handleOAuthError(error, 'Token refresh failed');
    }
  }
  
  /**
   * Get user profile information
   * Must be implemented by each platform
   */
  abstract getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
  
  /**
   * Validate token by making a test API call
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      if (error instanceof TokenExpiredError || error instanceof InvalidTokenError) {
        return false;
      }
      throw error;
    }
  }
  
  /**
   * Revoke access token
   */
  async revokeToken(accessToken: string): Promise<void> {
    if (!this.revokeEndpoint) {
      logger.warn(`[${this.platform}] Token revocation not supported`);
      return;
    }
    
    try {
      logger.info(`[${this.platform}] Revoking access token`);
      
      await axios.post(
        this.revokeEndpoint,
        { token: accessToken },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      
      logger.info(`[${this.platform}] Token revoked successfully`);
    } catch (error) {
      logger.error(`[${this.platform}] Token revocation failed`, { error });
      // Don't throw - revocation failure is not critical
    }
  }
  
  /**
   * Handle OAuth errors with proper error types
   */
  protected handleOAuthError(error: unknown, context: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const data: any = axiosError.response?.data;
      
      logger.error(`[${this.platform}] ${context}`, {
        status,
        error: sanitizeForLog(data),
      });
      
      // Handle specific HTTP status codes
      if (status === 401) {
        throw new InvalidTokenError(this.platform);
      }
      
      if (status === 429) {
        const retryAfter = axiosError.response?.headers['retry-after'];
        throw new RateLimitError(
          this.platform,
          retryAfter ? parseInt(retryAfter) : undefined
        );
      }
      
      // Handle OAuth error responses
      if (data?.error) {
        if (data.error === 'invalid_grant' || data.error === 'expired_token') {
          throw new TokenExpiredError(this.platform);
        }
        
        throw new OAuthError(
          data.error_description || data.error,
          data.error,
          this.platform
        );
      }
      
      throw new OAuthError(
        axiosError.message,
        'NETWORK_ERROR',
        this.platform
      );
    }
    
    logger.error(`[${this.platform}] ${context}`, { error });
    throw new OAuthError(
      context,
      'UNKNOWN_ERROR',
      this.platform
    );
  }
  
  /**
   * Make authenticated API request
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    accessToken: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      data?: any;
      params?: Record<string, any>;
    } = {}
  ): Promise<T> {
    try {
      const response = await axios({
        method: options.method || 'GET',
        url,
        data: options.data,
        params: options.params,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      return response.data;
    } catch (error) {
      return this.handleOAuthError(error, 'API request failed');
    }
  }
}