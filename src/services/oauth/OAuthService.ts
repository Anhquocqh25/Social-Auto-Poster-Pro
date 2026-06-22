import {
  IOAuthProvider,
  PlatformType,
  OAuthConfig,
  AccountConnectionResult,
} from '@/types/oauth';
import { MockOAuthProvider } from './MockOAuthProvider';
import { FacebookOAuthProvider } from './FacebookOAuthProvider';
import { TikTokOAuthProvider } from './TikTokOAuthProvider';
import { logger } from '@/lib/logger';
 import {
   encrypt,
   decrypt,
   generateSecureRandom,
   sanitizeForLog,
 } from '@/lib/crypto';
import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import { loadFacebookEnvConfig } from '@/services/facebook/FacebookConfigService';

 const OAUTH_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkceCodeChallenge(codeVerifier: string) {
  return toBase64Url(createHash('sha256').update(codeVerifier).digest());
}

 export class OAuthService {
   private providers: Map<PlatformType, IOAuthProvider> = new Map();
   private useMockProviders: boolean;

  constructor(useMockProviders = true) {
    this.useMockProviders = useMockProviders;
    this.initializeProviders();
  }

  private initializeProviders() {
    logger.info('[OAuth] Initializing OAuth providers', { useMock: this.useMockProviders });

    const facebookEnv = loadFacebookEnvConfig();

    const facebookConfig: OAuthConfig = {
      ...facebookEnv.oauthConfig,
    };

    const tiktokConfig: OAuthConfig = {
      clientId: process.env.TIKTOK_CLIENT_ID || '',
      clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
      redirectUri: 'http://localhost:3000/oauth/callback',
      scopes: ['video.upload', 'video.publish', 'user.info.basic'],
    };

    if (this.useMockProviders) {
      this.providers.set('facebook', new MockOAuthProvider('facebook', facebookConfig));
      this.providers.set('tiktok', new MockOAuthProvider('tiktok', tiktokConfig));
    } else {
      if (facebookEnv.valid) {
        this.providers.set(
          'facebook',
          new FacebookOAuthProvider(facebookConfig, facebookEnv.graphApiVersion)
        );
      }

      this.providers.set('tiktok', new TikTokOAuthProvider(tiktokConfig));
    }

    logger.info('[OAuth] Providers initialized', {
      platforms: Array.from(this.providers.keys()),
    });
  }

  getProvider(platform: PlatformType): IOAuthProvider {
    const provider = this.providers.get(platform);
    if (!provider) {
      throw new Error(`OAuth provider not found for platform: ${platform}`);
    }
    return provider;
  }

  private getFacebookConfigOrThrow() {
    const facebookEnv = loadFacebookEnvConfig();

    if (!facebookEnv.valid) {
      throw new Error(
        `Facebook configuration is invalid: ${facebookEnv.errors.join('; ')}`
      );
    }

    return facebookEnv;
  }

   private async clearOAuthSession(state: string) {
    const result = await prisma.oAuthSession.deleteMany({
      where: { state },
    });

    return result.count > 0;
  }

  private validateRedirectUri(platform: PlatformType, redirectUri: string) {
    try {
      const parsed = new URL(redirectUri);

      if (platform === 'facebook') {
        if (!(parsed.protocol === 'https:' || parsed.hostname === 'localhost')) {
          throw new Error(
            'Facebook redirect URI must use HTTPS or point to localhost.'
          );
        }
      }
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Invalid redirect URI: ${error.message}`
          : 'Invalid redirect URI.'
      );
    }
  }

  async startOAuthFlow(platform: PlatformType): Promise<{ url: string; state: string }> {
    logger.info('[OAuth] Starting OAuth flow', { platform });

    const provider = this.getProvider(platform);
    const state = generateSecureRandom(32);
    let redirectUri = 'http://localhost:3000/oauth/callback';
    let codeVerifier: string | undefined;
    let codeChallenge: string | undefined;

     if (platform === 'facebook') {
       const facebookEnv = this.getFacebookConfigOrThrow();
       redirectUri = facebookEnv.redirectUri;
       this.validateRedirectUri(platform, redirectUri);

       codeVerifier = generateSecureRandom(64);
       codeChallenge = createPkceCodeChallenge(codeVerifier);
     }

    const expiresAt = new Date(Date.now() + OAUTH_SESSION_TIMEOUT_MS);

    await prisma.oAuthSession.create({
      data: {
        state,
        platform,
        redirectUri,
        codeVerifier,
        createdAt: new Date(),
        expiresAt,
      },
    });

    const facebookProvider =
      platform === 'facebook' && provider instanceof FacebookOAuthProvider
        ? provider
        : null;

    const url = facebookProvider
      ? await facebookProvider.getAuthorizationUrl(state, redirectUri, codeChallenge)
      : await provider.getAuthorizationUrl(state, redirectUri);

    logger.info('[OAuth] OAuth flow started', {
      platform,
      redirectUri,
      hasPkce: !!codeVerifier,
      expiresAt: expiresAt.toISOString(),
    });

    return { url, state };
  }

  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<AccountConnectionResult> {
    let sessionDeleted = false;

    try {
      logger.info('[OAuth] Handling OAuth callback');

      if (!code?.trim()) {
        return { success: false, error: 'Missing OAuth authorization code.' };
      }

      if (!state?.trim()) {
        return { success: false, error: 'Missing OAuth state parameter.' };
      }

      const session = await prisma.oAuthSession.findUnique({
        where: { state },
      });

      if (!session) {
        logger.error('[OAuth] Invalid OAuth state');
        return { success: false, error: 'Invalid OAuth state.' };
      }

       if (session.expiresAt < new Date()) {
         logger.error('[OAuth] OAuth session expired');
         await this.clearOAuthSession(state);
         sessionDeleted = true;
         return {
           success: false,
           error: 'OAuth session expired. Start the Facebook connection again.',
         };
       }

      const platform = session.platform as PlatformType;

      if (platform === 'facebook') {
        const facebookEnv = this.getFacebookConfigOrThrow();
         if (session.redirectUri !== facebookEnv.redirectUri) {
           await this.clearOAuthSession(state);
           sessionDeleted = true;
           return {
             success: false,
             error: 'Redirect URI mismatch. Verify Facebook app callback configuration.',
           };
         }

        this.validateRedirectUri(platform, session.redirectUri);
      }

      const provider = this.getProvider(platform);

      const tokenResponse = await provider.exchangeCodeForToken(
        code,
        session.redirectUri,
        session.codeVerifier || undefined
      );

      const userInfo = await provider.getUserInfo(tokenResponse.access_token);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      const account = await prisma.account.upsert({
        where: {
          platform_accountId: {
            platform,
            accountId: userInfo.id,
          },
        },
        create: {
          platform,
          accountId: userInfo.id,
          accountName: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
          accessToken: encrypt(tokenResponse.access_token),
          refreshToken: tokenResponse.refresh_token
            ? encrypt(tokenResponse.refresh_token)
            : null,
          tokenExpiresAt: expiresAt,
          status: 'active',
        },
        update: {
          accountName: userInfo.name,
          avatarUrl: userInfo.avatarUrl,
          accessToken: encrypt(tokenResponse.access_token),
          refreshToken: tokenResponse.refresh_token
            ? encrypt(tokenResponse.refresh_token)
            : null,
          tokenExpiresAt: expiresAt,
          status: 'active',
          updatedAt: new Date(),
        },
      });

      await prisma.platformToken.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
          encryptedToken: encrypt(tokenResponse.access_token),
          encryptedRefresh: tokenResponse.refresh_token
            ? encrypt(tokenResponse.refresh_token)
            : null,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          issuedAt: new Date(),
          expiresAt,
        },
        update: {
          encryptedToken: encrypt(tokenResponse.access_token),
          encryptedRefresh: tokenResponse.refresh_token
            ? encrypt(tokenResponse.refresh_token)
            : null,
          tokenType: tokenResponse.token_type,
          scope: tokenResponse.scope,
          lastRefreshed: new Date(),
          expiresAt,
          refreshCount: { increment: 1 },
        },
      });

      let pages:
        | Array<{
            id: string;
            name: string;
            category?: string;
            accessToken?: string;
          }>
        | undefined;

      const selectedPage: { id: string; name: string } | null = null;

      if (platform === 'facebook') {
        await prisma.platformSetting.deleteMany({
          where: {
            accountId: account.id,
            OR: [
              {
                settingKey: {
                  in: [
                    'facebook.selectedPage',
                    'facebook.selectedPageName',
                    'facebook.selectedPageCategory',
                    'facebook.permissionsMissing',
                    'facebook.pages',
                    'facebook.pagesLastFetchedAt',
                  ],
                },
              },
              {
                settingKey: {
                  startsWith: 'facebook.pageToken.',
                },
              },
            ],
          },
        });

        await prisma.platformToken.update({
          where: { accountId: account.id },
          data: {
            scope: tokenResponse.scope ?? '',
          },
        });

        pages = [];
      }

       await this.clearOAuthSession(state);
       sessionDeleted = true;

      logger.info('[OAuth] Account connected successfully', {
        platform,
        accountId: account.id,
        pagesFetched: 0,
      });

      return {
        success: true,
        account: {
          id: account.id,
          platform,
          accountId: account.accountId,
          accountName: account.accountName,
          avatarUrl: account.avatarUrl || undefined,
        },
        pages,
        selectedPage,
      };
    } catch (error) {
      logger.error('[OAuth] OAuth callback failed', {
        error: sanitizeForLog(error),
      });

       if (!sessionDeleted) {
         try {
           await this.clearOAuthSession(state);
         } catch {
           // ignore cleanup failures
         }
       }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OAuth error.',
      };
    }
  }

  async refreshAccountToken(accountId: number): Promise<boolean> {
    try {
      logger.info('[OAuth] Refreshing account token', { accountId });

      const account = await prisma.account.findUnique({
        where: { id: accountId },
      });

      if (!account || !account.refreshToken) {
        logger.error('[OAuth] Account or refresh token not found');
        return false;
      }

      const provider = this.getProvider(account.platform as PlatformType);
      const refreshToken = decrypt(account.refreshToken);

      const tokenResponse = await provider.refreshAccessToken(refreshToken);

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : null;

      await prisma.account.update({
        where: { id: accountId },
        data: {
          accessToken: encrypt(tokenResponse.access_token),
          tokenExpiresAt: expiresAt,
          status: 'active',
          updatedAt: new Date(),
        },
      });

      await prisma.platformToken.update({
        where: { accountId },
        data: {
          encryptedToken: encrypt(tokenResponse.access_token),
          lastRefreshed: new Date(),
          expiresAt,
          refreshCount: { increment: 1 },
          scope: tokenResponse.scope,
        },
      });

      logger.info('[OAuth] Token refreshed successfully', { accountId });
      return true;
    } catch (error) {
      logger.error('[OAuth] Token refresh failed', {
        accountId,
        error: sanitizeForLog(error),
      });

      await prisma.account.update({
        where: { id: accountId },
        data: { status: 'expired' },
      });

      return false;
    }
  }
}

export const oauthService = new OAuthService(true);