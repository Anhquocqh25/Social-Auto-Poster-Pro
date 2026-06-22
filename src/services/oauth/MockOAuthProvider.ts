import { BaseOAuthProvider } from './BaseOAuthProvider';
import {
  OAuthConfig,
  OAuthTokenResponse,
  OAuthUserInfo,
  PlatformType,
} from '@/types/oauth';
import { logger } from '@/lib/logger';

/**
 * Mock OAuth Provider for Testing
 * Simulates OAuth flow without real API calls
 */
export class MockOAuthProvider extends BaseOAuthProvider {
  readonly platform: PlatformType;
  readonly name: string;
  
  protected authEndpoint = 'https://mock-auth.example.com/oauth/authorize';
  protected tokenEndpoint = 'https://mock-auth.example.com/oauth/token';
  protected userInfoEndpoint = 'https://mock-auth.example.com/api/me';
  protected revokeEndpoint = 'https://mock-auth.example.com/oauth/revoke';
  
  private mockUsers: Map<string, OAuthUserInfo> = new Map();
  private mockTokens: Map<string, { token: string; expires: Date }> = new Map();
  
  constructor(platform: PlatformType, config: OAuthConfig) {
    super(config);
    this.platform = platform;
    this.name = `Mock ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
    
    // Initialize mock data
    this.initializeMockData();
  }
  
  private initializeMockData() {
    // Create mock users for each platform
    const mockUser: OAuthUserInfo = {
      id: `mock_${this.platform}_123456`,
      name: `Test ${this.platform} Account`,
      email: `test@${this.platform}.com`,
      avatarUrl: `https://via.placeholder.com/150?text=${this.platform}`,
      platform: this.platform,
    };
    
    this.mockUsers.set('mock_access_token', mockUser);
  }
  
  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    logger.info(`[${this.platform}] Mock: Generating authorization URL`, {
      state,
      redirectUri,
    });
    
    // Return mock auth URL that includes a mock code
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri,
      state,
      scope: this.config.scopes.join(','),
      response_type: 'code',
      mock_code: 'mock_auth_code_' + Date.now(), // Include mock code in URL
    });
    
    return `${this.authEndpoint}?${params.toString()}`;
  }
  
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  // codeVerifier?: string
  ): Promise<OAuthTokenResponse> {
    logger.info(`[${this.platform}] Mock: Exchanging code for token`, {
      code,
      redirectUri,
    });
    
    // Simulate API delay
    await this.simulateDelay(500);
    
    // Generate mock tokens
    const mockToken: OAuthTokenResponse = {
      access_token: `mock_access_token_${Date.now()}`,
      refresh_token: `mock_refresh_token_${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600, // 1 hour
      scope: this.config.scopes.join(' '),
    };
    
    // Store mock token
    const expires = new Date(Date.now() + mockToken.expires_in! * 1000);
    this.mockTokens.set(mockToken.access_token, {
      token: mockToken.access_token,
      expires,
    });
    
    // Register user for this token
    const mockUser: OAuthUserInfo = {
      id: `mock_${this.platform}_${Date.now()}`,
      name: `Mock ${this.platform} User`,
      email: `mock@${this.platform}.test`,
      avatarUrl: `https://via.placeholder.com/150?text=${this.platform}`,
      platform: this.platform,
    };
    this.mockUsers.set(mockToken.access_token, mockUser);
    
    logger.info(`[${this.platform}] Mock: Token exchange successful`);
    return mockToken;
  }
  
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    logger.info(`[${this.platform}] Mock: Refreshing access token`);
    
    await this.simulateDelay(300);
    
    const mockToken: OAuthTokenResponse = {
      access_token: `mock_access_token_refreshed_${Date.now()}`,
      refresh_token: refreshToken, // Keep same refresh token
      token_type: 'Bearer',
      expires_in: 3600,
      scope: this.config.scopes.join(' '),
    };
    
    logger.info(`[${this.platform}] Mock: Token refresh successful`);
    return mockToken;
  }
  
  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    logger.info(`[${this.platform}] Mock: Fetching user info`);
    
    await this.simulateDelay(200);
    
    // Check if token exists
    const storedToken = this.mockTokens.get(accessToken);
    if (!storedToken) {
      // Return default mock user if token not found
      return {
        id: `mock_${this.platform}_default`,
        name: `Mock ${this.platform} User`,
        email: `mock@${this.platform}.test`,
        avatarUrl: `https://via.placeholder.com/150?text=${this.platform}`,
        platform: this.platform,
      };
    }
    
    // Check if token expired
    if (storedToken.expires < new Date()) {
      logger.warn(`[${this.platform}] Mock: Token expired`);
      throw new Error('Token expired');
    }
    
    const user = this.mockUsers.get(accessToken);
    if (!user) {
      // Return default user
      return {
        id: `mock_${this.platform}_${Date.now()}`,
        name: `Mock ${this.platform} User`,
        email: `mock@${this.platform}.test`,
        avatarUrl: `https://via.placeholder.com/150?text=${this.platform}`,
        platform: this.platform,
      };
    }
    
    logger.info(`[${this.platform}] Mock: User info fetched successfully`);
    return user;
  }
  
  async validateToken(accessToken: string): Promise<boolean> {
    logger.info(`[${this.platform}] Mock: Validating token`);
    
    await this.simulateDelay(100);
    
    const storedToken = this.mockTokens.get(accessToken);
    if (!storedToken) {
      return true; // For mock, accept any token
    }
    
    const isValid = storedToken.expires > new Date();
    logger.info(`[${this.platform}] Mock: Token validation result: ${isValid}`);
    return isValid;
  }
  
  async revokeToken(accessToken: string): Promise<void> {
    logger.info(`[${this.platform}] Mock: Revoking token`);
    
    await this.simulateDelay(150);
    
    // Remove token from storage
    this.mockTokens.delete(accessToken);
    this.mockUsers.delete(accessToken);
    
    logger.info(`[${this.platform}] Mock: Token revoked successfully`);
  }
  
  /**
   * Simulate API delay
   */
  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Simulate token expiration for testing
   */
  public expireToken(accessToken: string): void {
    const storedToken = this.mockTokens.get(accessToken);
    if (storedToken) {
      storedToken.expires = new Date(Date.now() - 1000); // Set to past
      logger.info(`[${this.platform}] Mock: Token expired manually`);
    }
  }
  
  /**
   * Simulate API error for testing
   */
  public simulateError(errorType: 'rate_limit' | 'invalid_token' | 'network_error'): void {
    logger.warn(`[${this.platform}] Mock: Simulating ${errorType} error`);
    // This would be used in tests to trigger error scenarios
  }
}