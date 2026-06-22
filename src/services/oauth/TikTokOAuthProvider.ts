import { BaseOAuthProvider } from './BaseOAuthProvider';
import {
  OAuthConfig,
  OAuthUserInfo,
  PlatformType,
} from '@/types/oauth';
import { logger } from '@/lib/logger';

/**
 * TikTok OAuth Provider
 * Implements OAuth 2.0 flow for TikTok Open Platform API
 * 
 * PLACEHOLDER: This is a mock implementation for Phase 3.
 * Real TikTok API integration will be implemented in a later phase.
 */
export class TikTokOAuthProvider extends BaseOAuthProvider {
  readonly platform: PlatformType = 'tiktok';
  readonly name = 'TikTok';
  
  protected authEndpoint = 'https://www.tiktok.com/v2/auth/authorize';
  protected tokenEndpoint = 'https://open.tiktokapis.com/v2/oauth/token';
  protected userInfoEndpoint = 'https://open.tiktokapis.com/v2/user/info';
  protected revokeEndpoint = 'https://open.tiktokapis.com/v2/oauth/revoke';
  
  constructor(config: OAuthConfig) {
    super(config);
    logger.info('[TikTok] OAuth Provider initialized (MOCK MODE)');
  }
  
  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    logger.info('[TikTok] Generating authorization URL (MOCK)', { state, redirectUri });
    
    // Build TikTok OAuth URL
    const params = {
      client_key: this.config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.config.scopes.join(','),
      response_type: 'code',
    };
    
    const url = this.buildAuthUrl(this.authEndpoint, params);
    logger.info('[TikTok] Authorization URL generated (MOCK)');
    
    return url;
  }
  
  async getUserInfo(_accessToken: string): Promise<OAuthUserInfo> {
    logger.info('[TikTok] Fetching user info (MOCK)');
    
    // MOCK: Return simulated TikTok user data
    // In real implementation, this would call TikTok Open Platform API
    const mockUser: OAuthUserInfo = {
      id: `tiktok_mock_${Date.now()}`,
      name: 'Mock TikTok Account',
      email: 'mock@tiktok.test',
      avatarUrl: 'https://via.placeholder.com/150?text=TikTok',
      platform: 'tiktok',
    };
    
    logger.info('[TikTok] User info fetched (MOCK)', { userId: mockUser.id });
    return mockUser;
  }
}