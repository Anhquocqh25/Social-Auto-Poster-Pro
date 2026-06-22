/**
 * OAuth 2.0 Type Definitions
 * Defines the contract for OAuth providers and related types
 */

export type PlatformType = 'facebook' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin' | 'youtube';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  platform: PlatformType;
}

export interface OAuthSession {
  state: string;
  platform: PlatformType;
  codeVerifier?: string;
  redirectUri: string;
  createdAt: Date;
  expiresAt: Date;
  flowType?: 'external_browser' | 'popup';
  status?: 'pending' | 'completed' | 'cancelled' | 'expired';
}

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
}

export interface AccountConnectionResult {
  success: boolean;
  account?: {
    id: number;
    platform: PlatformType;
    accountId: string;
    accountName: string;
    avatarUrl?: string;
  };
  pages?: Array<{
    id: string;
    name: string;
    category?: string;
    accessToken?: string;
  }>;
  selectedPage?: {
    id: string;
    name: string;
  } | null;
  cancelled?: boolean;
  requiresReconnect?: boolean;
  error?: string;
}

/**
 * Base OAuth Provider Interface
 * All platform providers must implement this interface
 */
export interface IOAuthProvider {
  readonly platform: PlatformType;
  readonly name: string;
  
  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;
  
  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokenResponse>;
  
  /**
   * Refresh an expired access token
   */
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>;
  
  /**
   * Fetch user profile information
   */
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
  
  /**
   * Validate token is still valid
   */
  validateToken(accessToken: string): Promise<boolean>;
  
  /**
   * Revoke access token
   */
  revokeToken(accessToken: string): Promise<void>;
}

/**
 * Platform-specific configuration
 */
export interface PlatformConfig {
  platform: PlatformType;
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  scopes: string[];
  authEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  revokeEndpoint?: string;
}

/**
 * OAuth Error Types
 */
export class OAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform: PlatformType
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export class TokenExpiredError extends OAuthError {
  constructor(platform: PlatformType) {
    super('Access token has expired', 'TOKEN_EXPIRED', platform);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends OAuthError {
  constructor(platform: PlatformType) {
    super('Access token is invalid', 'INVALID_TOKEN', platform);
    this.name = 'InvalidTokenError';
  }
}

export class RateLimitError extends OAuthError {
  constructor(platform: PlatformType, public retryAfter?: number) {
    super('Rate limit exceeded', 'RATE_LIMIT', platform);
    this.name = 'RateLimitError';
  }
}