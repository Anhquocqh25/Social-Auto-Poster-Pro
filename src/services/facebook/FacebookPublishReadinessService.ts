import prisma from '@/lib/prisma';
import { FacebookPageSummary } from './FacebookProviderTypes';
import { loadFacebookEnvConfig } from './FacebookConfigService';

export type FacebookPublishBlockedReason =
  | 'real_publishing_disabled'
  | 'real_publishing_not_implemented'
  | 'missing_page_target'
  | 'missing_source_account'
  | 'inactive_account'
  | 'missing_permissions'
  | 'missing_page'
  | 'missing_page_access_token'
  | 'legacy_account_target'
  | 'unsupported_target';

export type FacebookPublishReadinessResult = {
  ready: boolean;
  blockedReason?: FacebookPublishBlockedReason;
  accountId?: number;
  pageIdMasked?: string;
  pageName?: string;
  missingPermissions?: string[];
  hasEncryptedPageToken?: boolean;
};

export type FacebookResolvedPublishTarget = {
  accountId: number;
  pageId: string;
  pageName: string;
  pageIdMasked: string;
  encryptedPageTokenKey: string;
  hasEncryptedPageToken: boolean;
  isLegacyFallback: boolean;
};

function maskPageId(pageId: string | null | undefined) {
  if (!pageId) {
    return undefined;
  }

  if (pageId.length <= 6) {
    return `••${pageId.slice(-2)}`;
  }

  return `${pageId.slice(0, 2)}••••${pageId.slice(-4)}`;
}

const REQUIRED_PAGE_PERMISSIONS = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
] as const;

type ResolvedResult =
  | {
      ok: true;
      target: FacebookResolvedPublishTarget;
    }
  | {
      ok: false;
      blockedReason: FacebookPublishBlockedReason;
      accountId?: number;
      pageIdMasked?: string;
      pageName?: string;
      missingPermissions?: string[];
      hasEncryptedPageToken?: boolean;
    };

export class FacebookPublishReadinessService {
  private async getPostWithTargets(postId: number) {
    return prisma.post.findUnique({
      where: { id: postId },
      include: {
        postTargets: {
          include: {
            account: {
              include: {
                platformToken: true,
                platformSettings: true,
              },
            },
          },
        },
      },
    });
  }

  private parseStoredPages(pagesRaw: string | null | undefined): FacebookPageSummary[] {
    if (!pagesRaw) {
      return [];
    }

    try {
      return JSON.parse(pagesRaw) as FacebookPageSummary[];
    } catch {
      return [];
    }
  }

  private resolveFromAccountAndPage(input: {
    account: {
      id: number;
      status: string;
      platformToken: {
        scope: string | null;
      } | null;
      platformSettings: Array<{
        settingKey: string;
        settingValue: string;
      }>;
    };
    pageId: string;
    pageName?: string | null;
  }): ResolvedResult {
    const { account, pageId, pageName } = input;

    if (account.status !== 'active') {
      return {
        ok: false,
        blockedReason: 'inactive_account',
        accountId: account.id,
        pageIdMasked: maskPageId(pageId),
        pageName: pageName ?? undefined,
      };
    }

    const grantedScopes = (account.platformToken?.scope ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

    const missingPermissions = REQUIRED_PAGE_PERMISSIONS.filter(
      (permission) => !grantedScopes.includes(permission)
    );

    if (missingPermissions.length > 0) {
      return {
        ok: false,
        blockedReason: 'missing_permissions',
        accountId: account.id,
        pageIdMasked: maskPageId(pageId),
        pageName: pageName ?? undefined,
        missingPermissions,
      };
    }

    const pagesRaw =
      account.platformSettings.find((setting) => setting.settingKey === 'facebook.pages')
        ?.settingValue ?? null;
    const pages = this.parseStoredPages(pagesRaw);
    const page = pages.find((entry) => entry.id === pageId);

    if (!page) {
      return {
        ok: false,
        blockedReason: 'missing_page',
        accountId: account.id,
        pageIdMasked: maskPageId(pageId),
        pageName: pageName ?? undefined,
      };
    }

    const encryptedPageTokenKey = `facebook.pageToken.${page.id}`;
    const encryptedPageTokenSetting = account.platformSettings.find(
      (setting) => setting.settingKey === encryptedPageTokenKey
    );
    const hasEncryptedPageToken = !!encryptedPageTokenSetting?.settingValue;

    if (!hasEncryptedPageToken) {
      return {
        ok: false,
        blockedReason: 'missing_page_access_token',
        accountId: account.id,
        pageIdMasked: maskPageId(page.id),
        pageName: page.name ?? pageName ?? undefined,
        hasEncryptedPageToken: false,
      };
    }

    return {
      ok: true,
      target: {
        accountId: account.id,
        pageId: page.id,
        pageName: page.name ?? pageName ?? 'Unknown Facebook Page',
        pageIdMasked: maskPageId(page.id) ?? 'Unknown',
        encryptedPageTokenKey,
        hasEncryptedPageToken: true,
        isLegacyFallback: false,
      },
    };
  }

  async resolveFacebookPublishTarget(postId: number): Promise<ResolvedResult> {
    const post = await this.getPostWithTargets(postId);

    if (!post || post.postTargets.length === 0) {
      return {
        ok: false,
        blockedReason: 'missing_page_target',
      };
    }

    const facebookTarget = post.postTargets.find(
      (target) => target.account.platform === 'facebook'
    );

    if (!facebookTarget) {
      return {
        ok: false,
        blockedReason: 'unsupported_target',
      };
    }

    const account = facebookTarget.account;

    if (!account) {
      return {
        ok: false,
        blockedReason: 'missing_source_account',
      };
    }

    if (facebookTarget.targetType === 'page') {
      if (!facebookTarget.pageId) {
        return {
          ok: false,
          blockedReason: 'missing_page_target',
          accountId: account.id,
          pageName: facebookTarget.pageName ?? undefined,
        };
      }

      return this.resolveFromAccountAndPage({
        account,
        pageId: facebookTarget.pageId,
        pageName: facebookTarget.pageName,
      });
    }

    const selectedPageId =
      account.platformSettings.find((setting) => setting.settingKey === 'facebook.selectedPage')
        ?.settingValue ?? null;
    const selectedPageName =
      account.platformSettings.find((setting) => setting.settingKey === 'facebook.selectedPageName')
        ?.settingValue ?? null;

    if (!selectedPageId) {
      return {
        ok: false,
        blockedReason: 'legacy_account_target',
        accountId: account.id,
      };
    }

    return this.resolveFromAccountAndPage({
      account,
      pageId: selectedPageId,
      pageName: selectedPageName,
    });
  }

  async resolveFacebookJobTarget(input: {
    accountId: number;
    pageId: string;
    pageName?: string | null;
  }): Promise<ResolvedResult> {
    const account = await prisma.account.findUnique({
      where: { id: input.accountId },
      include: {
        platformToken: true,
        platformSettings: true,
      },
    });

    if (!account || account.platform !== 'facebook') {
      return {
        ok: false,
        blockedReason: 'missing_source_account',
        accountId: input.accountId,
        pageIdMasked: maskPageId(input.pageId),
        pageName: input.pageName ?? undefined,
      };
    }

    if (!input.pageId) {
      return {
        ok: false,
        blockedReason: 'missing_page_target',
        accountId: input.accountId,
        pageName: input.pageName ?? undefined,
      };
    }

    return this.resolveFromAccountAndPage({
      account,
      pageId: input.pageId,
      pageName: input.pageName,
    });
  }

  async getPostReadiness(postId: number): Promise<FacebookPublishReadinessResult> {
    const resolved = await this.resolveFacebookPublishTarget(postId);

    if (!resolved.ok) {
      return {
        ready: false,
        blockedReason: resolved.blockedReason,
        accountId: resolved.accountId,
        pageIdMasked: resolved.pageIdMasked,
        pageName: resolved.pageName,
        missingPermissions: resolved.missingPermissions,
        hasEncryptedPageToken: resolved.hasEncryptedPageToken,
      };
    }

    const facebookConfig = loadFacebookEnvConfig();

    return {
      ready: false,
      blockedReason: facebookConfig.realPublishingEnabled
        ? 'real_publishing_not_implemented'
        : 'real_publishing_disabled',
      accountId: resolved.target.accountId,
      pageIdMasked: resolved.target.pageIdMasked,
      pageName: resolved.target.pageName,
      missingPermissions: [],
      hasEncryptedPageToken: resolved.target.hasEncryptedPageToken,
    };
  }
}

export const facebookPublishReadinessService = new FacebookPublishReadinessService();