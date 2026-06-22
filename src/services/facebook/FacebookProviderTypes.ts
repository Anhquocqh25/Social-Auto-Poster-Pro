export type FacebookPublishMode = 'simulation' | 'real';

export interface FacebookPermissionStatus {
  permission: string;
  granted: boolean;
  declined?: boolean;
  expired?: boolean;
}

export interface FacebookPageSummary {
  id: string;
  name: string;
  accessToken: string;
  category?: string;
  pictureUrl?: string;
  tasks?: string[];
  permissions?: FacebookPermissionStatus[];
}

export interface FacebookAccountContext {
  accountId: number;
  platformAccountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
}

export interface FacebookPublishRequest {
  pageId: string;
  pageAccessToken: string;
  message?: string;
  mediaType?: 'photo' | 'video' | 'none';
  mediaUrl?: string;
  mediaLocalPath?: string;
  publishMode: FacebookPublishMode;
}

export interface FacebookPublishResult {
  success: boolean;
  postId?: string;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: Record<string, unknown>;
  mode: FacebookPublishMode;
  finalState?: 'published' | 'failed' | 'needs_verification';
}

export interface IFacebookAuthProvider {
  getAuthorizationUrl(state: string, redirectUri: string): Promise<string>;
  exchangeCodeForToken(code: string, redirectUri: string, codeVerifier?: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | null;
    scope?: string;
    tokenType: string;
  }>;
  revoke(accessToken: string): Promise<void>;
  validateState(state: string, expectedState: string): boolean;
}

export interface IFacebookTokenProvider {
  isExpired(expiresAt?: Date | null): boolean;
  shouldRefresh(expiresAt?: Date | null, thresholdMinutes?: number): boolean;
  refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date | null;
    scope?: string;
    tokenType: string;
  }>;
  validateAccessToken(accessToken: string): Promise<boolean>;
}

export interface IFacebookPageProvider {
  fetchPages(userAccessToken: string): Promise<FacebookPageSummary[]>;
  fetchPermissions(userAccessToken: string): Promise<FacebookPermissionStatus[]>;
  validateRequiredPermissions(
    permissions: FacebookPermissionStatus[],
    requiredPermissions: string[]
  ): {
    ok: boolean;
    missing: string[];
  };
}

export interface IFacebookMediaProvider {
  validateMedia(input: {
    mediaType?: 'photo' | 'video' | 'none';
    mediaUrl?: string;
    mediaLocalPath?: string;
  }): Promise<{
    ok: boolean;
    error?: string;
  }>;
}

export interface IFacebookPostProvider {
  publishText(request: FacebookPublishRequest): Promise<FacebookPublishResult>;
  publishImage(request: FacebookPublishRequest): Promise<FacebookPublishResult>;
  publishVideo(request: FacebookPublishRequest): Promise<FacebookPublishResult>;
}