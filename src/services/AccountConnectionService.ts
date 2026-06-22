import prisma from '@/lib/prisma';
import { encrypt } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { appSettingsService } from './AppSettingsService';
import { accountService } from './AccountService';
import {
  FACEBOOK_PAGE_READY_SCOPES,
  FACEBOOK_REQUIRED_PERMISSIONS,
  loadFacebookEnvConfig,
} from './facebook/FacebookConfigService';
import { FacebookPageProvider } from './facebook/FacebookPageProvider';

function isSimulationAccount(accountId: string) {
  return accountId.startsWith('mock_facebook_');
}

function getTokenHealth(tokenExpiresAt: Date | null) {
  if (!tokenExpiresAt) {
    return 'missing' as const;
  }

  const now = Date.now();
  const expiresAt = tokenExpiresAt.getTime();

  if (expiresAt <= now) {
    return 'expired' as const;
  }

  if (expiresAt - now <= 24 * 60 * 60 * 1000) {
    return 'expiring' as const;
  }

  return 'healthy' as const;
}

export class AccountConnectionService {
  private readonly facebookPageProvider = new FacebookPageProvider();

  async getConnectionStatus() {
    const schedulerSettings = await appSettingsService.getSchedulerSettings();
    const facebookConfig = loadFacebookEnvConfig();

    const facebookAccounts = await prisma.account.findMany({
      where: { platform: 'facebook' },
      orderBy: { createdAt: 'desc' },
      include: {
        platformToken: true,
        platformSettings: true,
      },
    });

    const realFacebookAccounts = facebookAccounts.filter(
      (account) => !isSimulationAccount(account.accountId)
    );

    const primaryRealFacebookAccount = realFacebookAccounts[0] ?? null;

    const selectedPageSetting = primaryRealFacebookAccount?.platformSettings.find(
      (setting) => setting.settingKey === 'facebook.selectedPage'
    );

    const selectedPageNameSetting = primaryRealFacebookAccount?.platformSettings.find(
      (setting) => setting.settingKey === 'facebook.selectedPageName'
    );

    const pagesSetting = primaryRealFacebookAccount?.platformSettings.find(
      (setting) => setting.settingKey === 'facebook.pages'
    );

    const pagesLastFetchedAtSetting = primaryRealFacebookAccount?.platformSettings.find(
      (setting) => setting.settingKey === 'facebook.pagesLastFetchedAt'
    );

    const pageTokenSetting = selectedPageSetting?.settingValue
      ? primaryRealFacebookAccount?.platformSettings.find(
          (setting) => setting.settingKey === `facebook.pageToken.${selectedPageSetting.settingValue}`
        )
      : null;

    const hasConnectedOAuth = realFacebookAccounts.length > 0;
    const hasExpiredToken = realFacebookAccounts.some((account) =>
      getTokenHealth(account.tokenExpiresAt ?? null) === 'expired'
    );

    const grantedScopes = Array.from(
      new Set(
        realFacebookAccounts.flatMap((account) =>
          (account.platformToken?.scope ?? '')
            .split(',')
            .map((scope) => scope.trim())
            .filter(Boolean)
        )
      )
    );

    const missingPermissions = FACEBOOK_PAGE_READY_SCOPES.filter(
      (permission) => !grantedScopes.includes(permission)
    );

    const permissionsGranted = hasConnectedOAuth && missingPermissions.length === 0;

    const oauthStatus = !facebookConfig.configured
      ? 'config_missing'
      : !facebookConfig.valid
        ? 'config_invalid'
        : !hasConnectedOAuth
          ? 'oauth_not_connected'
          : hasExpiredToken
            ? 'token_expired'
            : 'oauth_connected';

    const statusLabelMap: Record<typeof oauthStatus, string> = {
      config_missing: 'Facebook Config Missing',
      config_invalid: 'Facebook Config Invalid',
      oauth_not_connected: 'OAuth Not Connected',
      oauth_connected: 'OAuth Connected',
      token_expired: 'Token Expired',
    };

    return {
      simulationMode: schedulerSettings.simulationMode,
      facebook: {
        available: true,
        configured: facebookConfig.configured,
        valid: facebookConfig.valid,
        appIdMasked: facebookConfig.maskedAppId,
        graphApiVersion: facebookConfig.graphApiVersion,
        redirectUri: facebookConfig.redirectUri,
        errors: facebookConfig.errors,
        warnings: facebookConfig.warnings,
        missingVars: facebookConfig.missingVars,
        invalidVars: facebookConfig.invalidVars,
        requiredEnvVars: [...facebookConfig.requiredEnvVars],
        requiredPermissions: [...FACEBOOK_PAGE_READY_SCOPES],
        status:
          schedulerSettings.simulationMode && !hasConnectedOAuth
            ? 'simulation_mode_active'
            : oauthStatus,
        statusLabel:
          schedulerSettings.simulationMode && !hasConnectedOAuth
            ? 'Simulation Mode Active'
            : statusLabelMap[oauthStatus],
        hasConnectedOAuth,
        tokenExpired: hasExpiredToken,
        reconnectRequired: hasExpiredToken || !permissionsGranted,
        realPublishingEnabled: facebookConfig.realPublishingEnabled,
        realPublishingFlagSource: facebookConfig.realPublishingFlagSource,
        permissionsGranted,
        missingPermissions,
        grantedScopes,
        selectedPage: selectedPageSetting
          ? {
              id: selectedPageSetting.settingValue,
              name: selectedPageNameSetting?.settingValue ?? null,
            }
          : null,
        connectedAccount: primaryRealFacebookAccount
          ? {
              id: primaryRealFacebookAccount.id,
              accountId: primaryRealFacebookAccount.accountId,
              accountName: primaryRealFacebookAccount.accountName,
              status: primaryRealFacebookAccount.status,
              tokenExpiresAt: primaryRealFacebookAccount.tokenExpiresAt?.toISOString() ?? null,
            }
          : null,
        accountActive: primaryRealFacebookAccount?.status === 'active',
        pageCount: (() => {
          if (!pagesSetting?.settingValue) return 0;
          try {
            const parsedPages = JSON.parse(pagesSetting.settingValue);
            return Array.isArray(parsedPages) ? parsedPages.length : 0;
          } catch {
            return 0;
          }
        })(),
        pageTokenExists: !!pageTokenSetting?.settingValue,
        selectedPageExists: !!selectedPageSetting?.settingValue,
        pagesLastFetchedAt: pagesLastFetchedAtSetting?.settingValue ?? null,
        setupInstructions: [
          'Create a Facebook app in Meta for Developers.',
          'Add Facebook Login and configure the exact redirect URI.',
          'Set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI, and FACEBOOK_GRAPH_API_VERSION.',
          'Connect OAuth, review granted permissions, then choose a manageable Facebook Page.',
        ],
        developerSetupUrl: 'https://developers.facebook.com/apps/',
      },
      tiktok: {
        available: false,
        configured: false as const,
        message: 'TikTok is coming in a later phase.',
      },
    };
  }

  async listAccounts() {
    const accounts = await prisma.account.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        platformSettings: true,
      },
    });

    return accounts.map((account) => {
      const isSimulation = isSimulationAccount(account.accountId);
      const selectedPageIdSetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.selectedPage'
      );
      const selectedPageNameSetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.selectedPageName'
      );
      const selectedPageCategorySetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.selectedPageCategory'
      );
      const permissionsMissingSetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.permissionsMissing'
      );
      const pagesSetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.pages'
      );
      const pagesLastFetchedAtSetting = account.platformSettings.find(
        (setting) => setting.settingKey === 'facebook.pagesLastFetchedAt'
      );

      const permissionsMissing = permissionsMissingSetting?.settingValue
        ? permissionsMissingSetting.settingValue
            .split(',')
            .map((permission) => permission.trim())
            .filter(Boolean)
        : [];

      let authorizedPages: Array<{
        accountId: number;
        pageId: string;
        pageName: string | null;
        category: string | null;
        pictureUrl?: string | null;
        isSelected: boolean;
        readiness: 'ready' | 'not_selected' | 'missing_permissions' | 'unknown';
        lastFetchedAt?: string | null;
        sourceAccountName: string;
        sourceAccountDbId: number;
      }> = [];

      if (pagesSetting?.settingValue) {
        try {
          const parsedPages = JSON.parse(pagesSetting.settingValue) as Array<{
            id: string;
            name?: string | null;
            category?: string | null;
            pictureUrl?: string | null;
          }>;

          authorizedPages = parsedPages.map((page) => ({
            accountId: account.id,
            pageId: page.id,
            pageName: page.name ?? null,
            category: page.category ?? null,
            pictureUrl: page.pictureUrl ?? null,
            isSelected: page.id === selectedPageIdSetting?.settingValue,
            readiness:
              permissionsMissing.length > 0
                ? 'missing_permissions'
                : page.id === selectedPageIdSetting?.settingValue
                  ? 'ready'
                  : 'not_selected',
            lastFetchedAt: pagesLastFetchedAtSetting?.settingValue ?? null,
            sourceAccountName: account.accountName,
            sourceAccountDbId: account.id,
          }));
        } catch {
          authorizedPages = [];
        }
      }

      if (
        authorizedPages.length === 0 &&
        selectedPageIdSetting?.settingValue &&
        account.platform === 'facebook' &&
        !isSimulation
      ) {
        authorizedPages = [
          {
            accountId: account.id,
            pageId: selectedPageIdSetting.settingValue,
            pageName: selectedPageNameSetting?.settingValue ?? null,
            category: selectedPageCategorySetting?.settingValue ?? null,
            pictureUrl: null,
            isSelected: true,
            readiness: permissionsMissing.length > 0 ? 'missing_permissions' : 'ready',
            lastFetchedAt: pagesLastFetchedAtSetting?.settingValue ?? null,
            sourceAccountName: account.accountName,
            sourceAccountDbId: account.id,
          },
        ];
      }

      const pageReadiness =
        account.platform !== 'facebook' || isSimulation
          ? 'unknown'
          : selectedPageIdSetting
            ? 'ready'
            : permissionsMissing.length > 0
              ? 'missing_permissions'
              : 'not_selected';

      return {
        id: account.id,
        platform: account.platform,
        accountId: account.accountId,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
        tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        isSimulation,
        tokenHealth: getTokenHealth(account.tokenExpiresAt ?? null),
        selectedPageId: selectedPageIdSetting?.settingValue ?? null,
        selectedPageName: selectedPageNameSetting?.settingValue ?? null,
        selectedPageCategory: selectedPageCategorySetting?.settingValue ?? null,
        permissionsMissing,
        pageReadiness,
        pagesFetched: authorizedPages.length,
        pagesLastFetchedAt: pagesLastFetchedAtSetting?.settingValue ?? null,
        authorizedPages,
      };
    });
  }

  async listFacebookPageTargets() {
    const accounts = await this.listAccounts();

    return accounts
      .filter((account) => !account.isSimulation && account.platform === 'facebook')
      .flatMap((account) => account.authorizedPages ?? [])
      .map((page) => ({
        pageId: page.pageId,
        pageName: page.pageName,
        category: page.category,
        pictureUrl: page.pictureUrl ?? null,
        sourceAccountId: page.accountId,
        sourceAccountName: page.sourceAccountName,
        sourceAccountDbId: page.sourceAccountDbId,
        isSelected: page.isSelected,
        pageReadiness: page.readiness,
      }));
  }

  async syncFacebookPagesForAccount(accountId: number): Promise<{
    pagesCount: number;
    selectedPageId: string | null;
    selectedPageName: string | null;
    missingPermissions: string[];
    hasEncryptedPageTokens: boolean;
  }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        platformToken: true,
      },
    });

    if (!account || account.platform !== 'facebook' || isSimulationAccount(account.accountId)) {
      throw new Error('Facebook page sync requires a real Facebook account.');
    }

    const userAccessToken = await accountService.getAccessToken(accountId);
    if (!userAccessToken) {
      throw new Error('Facebook user access token is unavailable.');
    }

    const manageablePages = await this.facebookPageProvider.fetchPages(userAccessToken);
    const permissions = await this.facebookPageProvider.fetchPermissions(userAccessToken);

    const grantedPermissionNames = permissions
      .filter((permission) => permission.granted)
      .map((permission) => permission.permission);

    await prisma.platformToken.updateMany({
      where: { accountId },
      data: {
        scope: grantedPermissionNames.join(','),
        lastRefreshed: new Date(),
      },
    });

    const permissionCheck = this.facebookPageProvider.validateRequiredPermissions(
      permissions,
      [...FACEBOOK_REQUIRED_PERMISSIONS]
    );

      const pagesData = manageablePages.map((page) => ({
        id: page.id,
        name: page.name,
        category: page.category ?? null,
        pictureUrl: page.pictureUrl ?? null,
      }));

    const selectedPageSetting = await prisma.platformSetting.findUnique({
      where: {
        accountId_settingKey: {
          accountId,
          settingKey: 'facebook.selectedPage',
        },
      },
    });

    const selectedExistingPageId = selectedPageSetting?.settingValue ?? null;
    const preservedSelectedPage =
      manageablePages.find((page) => page.id === selectedExistingPageId) ?? null;
    const fallbackPage = manageablePages[0] ?? null;
    const nextSelectedPage = preservedSelectedPage ?? fallbackPage;

    await prisma.platformSetting.deleteMany({
      where: {
        accountId,
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

    const settingsToCreate = [
      {
        accountId,
        settingKey: 'facebook.pages',
        settingValue: JSON.stringify(pagesData),
      },
      {
        accountId,
        settingKey: 'facebook.pagesLastFetchedAt',
        settingValue: new Date().toISOString(),
      },
      ...manageablePages.map((page) => ({
        accountId,
        settingKey: `facebook.pageToken.${page.id}`,
        settingValue: encrypt(page.accessToken),
      })),
    ];

    if (nextSelectedPage) {
      settingsToCreate.push(
        {
          accountId,
          settingKey: 'facebook.selectedPage',
          settingValue: nextSelectedPage.id,
        },
        {
          accountId,
          settingKey: 'facebook.selectedPageName',
          settingValue: nextSelectedPage.name,
        },
        {
          accountId,
          settingKey: 'facebook.selectedPageCategory',
          settingValue: nextSelectedPage.category ?? '',
        }
      );
    }

    if (permissionCheck.missing.length > 0) {
      settingsToCreate.push({
        accountId,
        settingKey: 'facebook.permissionsMissing',
        settingValue: permissionCheck.missing.join(','),
      });
    }

    if (settingsToCreate.length > 0) {
      await prisma.platformSetting.createMany({
        data: settingsToCreate,
      });
    }

    return {
      pagesCount: manageablePages.length,
      selectedPageId: nextSelectedPage?.id ?? null,
      selectedPageName: nextSelectedPage?.name ?? null,
      missingPermissions: permissionCheck.missing,
      hasEncryptedPageTokens: manageablePages.length > 0,
    };
  }

  async createMockFacebookAccount() {
    const existing = await prisma.account.findFirst({
      where: {
        platform: 'facebook',
        accountId: {
          startsWith: 'mock_facebook_',
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return {
        created: false,
        account: {
          id: existing.id,
          platform: existing.platform,
          accountId: existing.accountId,
          accountName: existing.accountName,
          avatarUrl: existing.avatarUrl,
          status: existing.status,
          tokenExpiresAt: existing.tokenExpiresAt ? existing.tokenExpiresAt.toISOString() : null,
          createdAt: existing.createdAt.toISOString(),
          updatedAt: existing.updatedAt.toISOString(),
          isSimulation: true,
          tokenHealth: getTokenHealth(existing.tokenExpiresAt ?? null),
        },
      };
    }

    const now = Date.now();
    const account = await prisma.account.create({
      data: {
        platform: 'facebook',
        accountId: `mock_facebook_${now}`,
        accountName: `Simulation Facebook Account ${new Date(now).toLocaleTimeString()}`,
        avatarUrl: null,
        accessToken: encrypt(`mock_access_token_${now}`),
        refreshToken: encrypt(`mock_refresh_token_${now}`),
        tokenExpiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });

      logger.info('[AccountConnectionService] Simulation Facebook account created', {
      accountId: account.id,
    });

    return {
      created: true,
      account: {
        id: account.id,
        platform: account.platform,
        accountId: account.accountId,
        accountName: account.accountName,
        avatarUrl: account.avatarUrl,
        status: account.status,
        tokenExpiresAt: account.tokenExpiresAt ? account.tokenExpiresAt.toISOString() : null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        isSimulation: true,
        tokenHealth: getTokenHealth(account.tokenExpiresAt ?? null),
      },
    };
  }
}

export const accountConnectionService = new AccountConnectionService();