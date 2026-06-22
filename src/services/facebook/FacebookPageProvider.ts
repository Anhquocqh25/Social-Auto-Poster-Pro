import axios from 'axios';
import { logger } from '@/lib/logger';
import { sanitizeForLog } from '@/lib/crypto';
import { OAuthError } from '@/types/oauth';
import {
  FacebookPageSummary,
  FacebookPermissionStatus,
  IFacebookPageProvider,
} from './FacebookProviderTypes';

export class FacebookPageProvider implements IFacebookPageProvider {
  private readonly pagesEndpoint = 'https://graph.facebook.com/v18.0/me/accounts';
  private readonly permissionsEndpoint = 'https://graph.facebook.com/v18.0/me/permissions';
  private readonly pictureEndpoint = 'https://graph.facebook.com/v18.0';

  async fetchPages(userAccessToken: string): Promise<FacebookPageSummary[]> {
    try {
      const response = await axios.get(this.pagesEndpoint, {
        params: {
          access_token: userAccessToken,
          fields: 'id,name,access_token,category,tasks,picture{url}',
        },
      });

      const data = response.data as {
        data?: Array<{
          id: string;
          name: string;
          access_token: string;
          category?: string;
          tasks?: string[];
          picture?: { data?: { url?: string } };
        }>;
      };

      return (data.data ?? []).map((page) => ({
        id: page.id,
        name: page.name,
        accessToken: page.access_token,
        category: page.category,
        tasks: page.tasks ?? [],
        pictureUrl: page.picture?.data?.url,
      }));
    } catch (error) {
      logger.error('[FacebookPageProvider] Failed to fetch pages', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError('Failed to fetch Facebook pages', 'FACEBOOK_PAGE_FETCH_FAILED', 'facebook');
    }
  }

  async fetchPermissions(userAccessToken: string): Promise<FacebookPermissionStatus[]> {
    try {
      const response = await axios.get(this.permissionsEndpoint, {
        params: {
          access_token: userAccessToken,
        },
      });

      const data = response.data as {
        data?: Array<{
          permission: string;
          status?: 'granted' | 'declined' | 'expired';
        }>;
      };

      return (data.data ?? []).map((item) => ({
        permission: item.permission,
        granted: item.status === 'granted',
        declined: item.status === 'declined',
        expired: item.status === 'expired',
      }));
    } catch (error) {
      logger.error('[FacebookPageProvider] Failed to fetch permissions', {
        error: sanitizeForLog(error),
      });
      throw new OAuthError(
        'Failed to fetch Facebook permissions',
        'FACEBOOK_PERMISSION_FETCH_FAILED',
        'facebook'
      );
    }
  }

  validateRequiredPermissions(
    permissions: FacebookPermissionStatus[],
    requiredPermissions: string[]
  ): {
    ok: boolean;
    missing: string[];
  } {
    const granted = new Set(
      permissions.filter((permission) => permission.granted).map((permission) => permission.permission)
    );

    const missing = requiredPermissions.filter((permission) => !granted.has(permission));

    return {
      ok: missing.length === 0,
      missing,
    };
  }

  async enrichPagesWithPermissions(
    pages: FacebookPageSummary[],
    userAccessToken: string
  ): Promise<FacebookPageSummary[]> {
    const permissions = await this.fetchPermissions(userAccessToken);
    return pages.map((page) => ({
      ...page,
      permissions,
    }));
  }

  async fetchPageAvatar(pageId: string, pageAccessToken: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.pictureEndpoint}/${pageId}/picture`, {
        params: {
          access_token: pageAccessToken,
          redirect: 'false',
          type: 'normal',
        },
      });

      const data = response.data as {
        data?: {
          url?: string;
        };
      };

      return data.data?.url;
    } catch (error) {
      logger.warn('[FacebookPageProvider] Failed to fetch page avatar', {
        pageId,
        error: sanitizeForLog(error),
      });
      return undefined;
    }
  }
}