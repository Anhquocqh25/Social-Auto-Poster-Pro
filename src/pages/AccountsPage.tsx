import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Facebook,
  ShieldCheck,
  AlertTriangle,
  Plus,
  RefreshCw,
  Unplug,
  ExternalLink,
  Copy,
  X,
} from 'lucide-react';
 import type {
   AccountConnectionStatusSnapshot,
   AccountSnapshot,
   FacebookPageSnapshot,
 } from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';
import { statusLabel } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

function statusVariant(status: string) {
  switch (status) {
    case 'active':
      return 'default';
    case 'expired':
      return 'destructive';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function tokenHealthVariant(tokenHealth?: AccountSnapshot['tokenHealth']) {
  switch (tokenHealth) {
    case 'healthy':
      return 'default';
    case 'expiring':
      return 'secondary';
    case 'expired':
      return 'destructive';
    default:
      return 'outline';
  }
}

function facebookStatusBadgeVariant(
  status?: AccountConnectionStatusSnapshot['facebook']['status']
) {
  switch (status) {
    case 'oauth_connected':
      return 'default';
    case 'simulation_mode_active':
      return 'secondary';
    case 'config_missing':
    case 'config_invalid':
    case 'token_expired':
      return 'destructive';
    case 'oauth_not_connected':
    default:
      return 'outline';
  }
}

const REDACTED_ERROR_KEYS = new Set(['access_token', 'code', 'client_secret', 'app_secret']);

function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
        key,
        REDACTED_ERROR_KEYS.has(key) ? '[REDACTED]' : redactSensitiveValues(nestedValue),
      ])
    );
  }

  return value;
}

function toSafeErrorString(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(redactSensitiveValues(error), null, 2);
    } catch {
      return 'Unknown Facebook OAuth error.';
    }
  }

  return 'Unknown Facebook OAuth error.';
}

function parseFacebookCallbackUrl(callbackUrl: string) {
  const trimmed = callbackUrl.trim();

  if (!trimmed) {
    throw new Error('Paste the full Facebook callback URL to continue.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error('Callback URL is invalid. Paste the full Facebook callback URL.');
  }

  const code = parsedUrl.searchParams.get('code');
  const state = parsedUrl.searchParams.get('state');
  const error = parsedUrl.searchParams.get('error');
  const errorDescription = parsedUrl.searchParams.get('error_description');

  if (error) {
    throw new Error(errorDescription || error);
  }

  if (!code || !state) {
    throw new Error('Callback URL must include both code and state parameters.');
  }

  return {
    code,
    state,
  };
}

 function facebookConfigStatusLabel(
   facebook?: AccountConnectionStatusSnapshot['facebook'],
   language: 'vi' | 'en' = 'vi'
 ) {
  if (!facebook) {
    return language === 'vi' ? 'Đang kiểm tra cấu hình Facebook' : 'Checking Facebook config';
  }

  if (!facebook.configured) {
    return language === 'vi' ? 'Thiếu cấu hình Facebook' : 'Facebook Config Missing';
  }

  if (!facebook.valid) {
    return language === 'vi' ? 'Cấu hình Facebook không hợp lệ' : 'Facebook Config Invalid';
  }

  return language === 'vi' ? 'Cấu hình Facebook sẵn sàng' : 'Facebook Config Ready';
}

function FacebookOAuthModal({
  open,
  oauthUrl,
  callbackUrl,
  callbackReady,
  statusMessage,
  working,
  language,
  onCallbackUrlChange,
  onCopyUrl,
  onOpenUrl,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  oauthUrl: string;
  callbackUrl: string;
  callbackReady: boolean;
  statusMessage: string | null;
  working: boolean;
  language: 'vi' | 'en';
  onCallbackUrlChange: (value: string) => void;
  onCopyUrl: () => void;
  onOpenUrl: () => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="so9-modal-shell">
      <Card className="so9-modal-card max-w-2xl shadow-2xl">
        <CardHeader className="so9-modal-header">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{language === 'vi' ? 'Kết nối Facebook' : 'Connect Facebook'}</CardTitle>
              <CardDescription>
                {language === 'vi' ? 'Đang chờ cấp quyền Facebook...' : 'Waiting for Facebook authorization...'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} disabled={working}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="so9-modal-body space-y-6">
          {statusMessage ? (
            <div className="so9-banner so9-banner-info border-0 shadow-none p-3 text-sm">{statusMessage}</div>
          ) : null}

          <div className="space-y-3 rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4">
            <div>
              <p className="font-medium">
                {language === 'vi' ? 'Bước 1: Mở URL này trong trình duyệt của bạn' : 'Step 1: Open this URL in your browser'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Ứng dụng sẽ không tự động mở Facebook. Bạn có thể dùng bất kỳ trình duyệt, tab hoặc thiết bị nào.'
                  : 'The app will not open Facebook automatically. You can use any browser, tab, or device.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook-oauth-url">{language === 'vi' ? 'URL OAuth' : 'OAuth URL'}</Label>
              <Input id="facebook-oauth-url" value={oauthUrl} readOnly />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={onCopyUrl} disabled={!oauthUrl}>
                <Copy className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Sao chép' : 'Copy'}
              </Button>
              <Button type="button" onClick={onOpenUrl} disabled={!oauthUrl}>
                {language === 'vi' ? 'Mở' : 'Open'}
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-4">
            <div>
              <p className="font-medium">
                {language === 'vi' ? 'Bước 2: Dán URL callback vào đây' : 'Step 2: Paste the callback URL here'}
              </p>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Sau khi Facebook chuyển hướng, hãy dán toàn bộ URL callback để ứng dụng hoàn tất kết nối cục bộ và an toàn.'
                  : 'After Facebook redirects, paste the full callback URL so the app can finish the connection locally and securely.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facebook-callback-url">{language === 'vi' ? 'URL callback' : 'Callback URL'}</Label>
              <Input
                id="facebook-callback-url"
                value={callbackUrl}
                onChange={(event) => onCallbackUrlChange(event.target.value)}
                placeholder="http://localhost:5173/oauth/callback?code=..."
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onSubmit} disabled={working || !callbackReady}>
                {language === 'vi' ? 'Kết nối' : 'Connect'}
              </Button>
            </div>
          </div>

          <div className="so9-modal-footer border-0 px-0 pb-0 pt-0">
            <Button type="button" variant="outline" onClick={onCancel} disabled={working}>
              {language === 'vi' ? 'Hủy' : 'Cancel'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FacebookSetupPanel({
  connectionStatus,
  actionMessage,
  working,
  language,
  onConnectFacebook,
  onCreateMockAccount,
}: {
  connectionStatus: AccountConnectionStatusSnapshot | null;
  actionMessage: string | null;
  working: boolean;
  language: 'vi' | 'en';
  onConnectFacebook: () => void;
  onCreateMockAccount: () => void;
}) {
  const facebook = connectionStatus?.facebook;

  return (
    <Card className="so9-flat-card">
      <CardHeader className="border-b border-[#e8eef8]">
        <CardTitle className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-blue-500" />
          {language === 'vi' ? 'Thiết lập Facebook & tình trạng tài khoản' : 'Facebook Setup & Account Health'}
        </CardTitle>
        <CardDescription>
          {language === 'vi'
            ? 'Đây là luồng gốc cho nút “Thêm kênh”. Kết nối Facebook tại đây để tải Trang thật, sau đó quản lý trạng thái và kênh mặc định trong Kết nối kênh.'
            : 'This is the source flow behind “Add Channel”. Connect Facebook here to load real Pages, then manage readiness and the default channel in Connected Channels.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={
              !facebook?.configured || !facebook?.valid ? 'destructive' : 'default'
            }
          >
            {facebookConfigStatusLabel(facebook, language)}
          </Badge>
          <Badge variant={facebookStatusBadgeVariant(facebook?.status)}>
            {facebook?.statusLabel ?? (language === 'vi' ? 'Đang kiểm tra trạng thái Facebook' : 'Checking Facebook status')}
          </Badge>
          {connectionStatus?.simulationMode && (
            <Badge variant="secondary">{language === 'vi' ? 'Đang ở chế độ mô phỏng' : 'Simulation Mode Active'}</Badge>
          )}
          {facebook?.permissionsGranted ? (
            <Badge variant="default">{language === 'vi' ? 'Quyền đã sẵn sàng' : 'Permissions Ready'}</Badge>
          ) : (
            <Badge variant="outline">{language === 'vi' ? 'Cần rà soát quyền' : 'Permissions Review Needed'}</Badge>
          )}
        </div>

        {actionMessage && (
          <div className="rounded-lg border p-3 text-sm">
            {actionMessage}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{language === 'vi' ? 'Trạng thái cấu hình' : 'Configuration Status'}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Chỉ bắt đầu truy cập Graph API thật khi cấu hình hợp lệ.'
                  : 'Real Graph API access only starts when configuration is valid.'}
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">App ID</span>
                <span className="font-mono">{facebook?.appIdMasked ?? (language === 'vi' ? 'Chưa cấu hình' : 'Not configured')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{language === 'vi' ? 'Phiên bản Graph API' : 'Graph API Version'}</span>
                <span className="font-mono">{facebook?.graphApiVersion ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Redirect URI</span>
                <span className="max-w-[60%] truncate text-right font-mono text-xs">
                  {facebook?.redirectUri ?? (language === 'vi' ? 'Chưa cấu hình' : 'Not configured')}
                </span>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Biến môi trường bắt buộc' : 'Required environment variables'}</p>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {(facebook?.requiredEnvVars ?? []).map((envVar) => (
                  <li key={envVar}>{envVar}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                {language === 'vi' ? 'App Secret không bao giờ hiển thị trong UI.' : 'App Secret is never shown in the UI.'}
              </p>
            </div>

            {facebook?.errors?.length ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">{language === 'vi' ? 'Lỗi cấu hình' : 'Configuration errors'}</p>
                <ul className="mt-2 list-disc pl-5 text-destructive">
                  {facebook.errors.map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {facebook?.warnings?.length ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                <p className="font-medium">{language === 'vi' ? 'Cảnh báo cấu hình' : 'Configuration warnings'}</p>
                <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                  {facebook.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <p className="text-sm font-medium">{language === 'vi' ? 'Trạng thái OAuth / tải Trang' : 'OAuth / Page Fetch Status'}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Giai đoạn này chỉ xác minh kết nối tài khoản, tải Trang có thể quản lý, lưu Trang đã chọn và tình trạng token.'
                  : 'This phase verifies account connection, manageable page fetch, selected page storage, and token health only.'}
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{language === 'vi' ? 'Kết nối OAuth' : 'OAuth connection'}</span>
                <span>{facebook?.hasConnectedOAuth ? (language === 'vi' ? 'Đã kết nối' : 'Connected') : (language === 'vi' ? 'Chưa kết nối' : 'Not connected')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{language === 'vi' ? 'Trạng thái token' : 'Token state'}</span>
                <span>{facebook?.tokenExpired ? (language === 'vi' ? 'Đã hết hạn' : 'Expired') : (language === 'vi' ? 'Dùng được / chưa rõ' : 'Usable / unknown')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{language === 'vi' ? 'Cần kết nối lại' : 'Reconnect required'}</span>
                <span>{facebook?.reconnectRequired ? (language === 'vi' ? 'Có' : 'Yes') : (language === 'vi' ? 'Không' : 'No')}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{language === 'vi' ? 'Trang đã chọn' : 'Selected page'}</span>
                <span className="max-w-[60%] truncate text-right">
                  {facebook?.selectedPage?.name ?? (language === 'vi' ? 'Chưa chọn' : 'Not selected yet')}
                </span>
              </div>
            </div>

            {facebook?.connectedAccount ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{facebook.connectedAccount.accountName}</p>
                <p className="text-muted-foreground">
                  {facebook.connectedAccount.accountId}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {facebook.connectedAccount.tokenExpiresAt
                    ? `${language === 'vi' ? 'Token hết hạn lúc' : 'Token expires'}: ${new Date(
                        facebook.connectedAccount.tokenExpiresAt
                      ).toLocaleString()}`
                    : language === 'vi' ? 'Facebook không cung cấp thời điểm hết hạn token' : 'Token expiry not provided by Facebook'}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                {language === 'vi' ? 'Chưa có tài khoản OAuth Facebook thật nào được kết nối.' : 'No real Facebook OAuth account is connected yet.'}
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{language === 'vi' ? 'Quyền bắt buộc' : 'Required permissions'}</p>
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {(facebook?.requiredPermissions ?? []).map((permission) => (
                  <li key={permission}>{permission}</li>
                ))}
              </ul>
              {facebook?.missingPermissions?.length ? (
                <div className="mt-3">
                  <p className="font-medium text-destructive">{language === 'vi' ? 'Thiếu quyền' : 'Missing permissions'}</p>
                  <ul className="mt-1 list-disc pl-5 text-destructive">
                    {facebook.missingPermissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{language === 'vi' ? 'Hướng dẫn thiết lập' : 'Setup instructions'}</p>
              <p className="text-sm text-muted-foreground">
                {language === 'vi'
                  ? 'Hãy làm theo các bước này trong Meta for Developers trước khi thử OAuth thật.'
                  : 'Follow these steps in Meta for Developers before attempting real OAuth.'}
              </p>
            </div>
            {facebook?.developerSetupUrl ? (
              <a
                href={facebook.developerSetupUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm text-blue-600 hover:underline"
              >
                Meta for Developers
                <ExternalLink className="ml-1 h-4 w-4" />
              </a>
            ) : null}
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {(facebook?.setupInstructions ?? []).map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </div>

        <div className="so9-info-note text-xs">
          {language === 'vi'
            ? 'Sau khi kết nối thành công, hãy sang Kết nối kênh để xem avatar Trang, tên Trang, trạng thái sẵn sàng, cờ mặc định và các thao tác cục bộ an toàn.'
            : 'After a successful connection, open Connected Channels to review the Page avatar, page name, readiness state, default flag, and safe local actions.'}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={onConnectFacebook}
            disabled={working || !facebook?.valid}
          >
            {language === 'vi' ? 'Kết nối Facebook' : 'Connect Facebook'}
          </Button>
          {connectionStatus?.simulationMode && (
            <Button variant="outline" onClick={onCreateMockAccount} disabled={working}>
              {language === 'vi' ? 'Tạo tài khoản Facebook mô phỏng' : 'Create Simulation Facebook Account'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AccountConnectionPanel({
  open,
  connectionStatus,
  actionMessage,
  working,
  language,
  onClose,
  onConnectFacebook,
  onCreateMockAccount,
}: {
  open: boolean;
  connectionStatus: AccountConnectionStatusSnapshot | null;
  actionMessage: string | null;
  working: boolean;
  language: 'vi' | 'en';
  onClose: () => void;
  onConnectFacebook: () => void;
  onCreateMockAccount: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{language === 'vi' ? 'Thêm tài khoản' : 'Add Account'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Chọn nhà cung cấp và xem lại trạng thái sẵn sàng trước khi kết nối.'
                : 'Choose a provider and review setup readiness before connecting.'}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            {language === 'vi' ? 'Đóng' : 'Close'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <FacebookSetupPanel
          connectionStatus={connectionStatus}
          actionMessage={actionMessage}
          working={working}
          language={language}
          onConnectFacebook={onConnectFacebook}
          onCreateMockAccount={onCreateMockAccount}
        />

        <Card className="so9-flat-card opacity-80">
          <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle className="text-base">TikTok</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Kết nối tài khoản TikTok được lên kế hoạch cho giai đoạn sau.'
                  : 'TikTok account connection is planned for a later phase.'}
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Badge variant="outline">{language === 'vi' ? 'Ngoài phạm vi' : 'Not in scope'}</Badge>
            <p className="text-sm text-muted-foreground">
              {language === 'vi'
                ? 'TikTok vẫn được tắt có chủ đích trong khi Phase 6 chỉ tập trung vào nền tảng OAuth / tài khoản Facebook.'
                : 'TikTok remains intentionally disabled while Phase 6 focuses only on Facebook OAuth/account foundations.'}
            </p>
            <Button variant="outline" disabled>
              {language === 'vi' ? 'TikTok chưa khả dụng' : 'TikTok Unavailable'}
            </Button>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function maskIdentifier(value: string | null | undefined) {
  if (!value) {
    return 'Unknown';
  }

  if (value.length <= 6) {
    return `••${value.slice(-2)}`;
  }

  return `${value.slice(0, 2)}••••${value.slice(-4)}`;
}

function FacebookPageCard({
  page,
  working,
  language,
  onSetDefault,
  onRefreshSourceAccount,
  onForgetLocalPage,
}: {
  page: FacebookPageSnapshot;
  working: boolean;
  language: 'vi' | 'en';
  onSetDefault: (page: FacebookPageSnapshot) => void;
  onRefreshSourceAccount: (accountId: number) => void;
  onForgetLocalPage: (page: FacebookPageSnapshot) => void;
}) {
  return (
    <div className="so9-surface flex flex-col gap-4 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Facebook className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{page.pageName ?? (language === 'vi' ? 'Trang Facebook chưa đặt tên' : 'Unnamed Facebook Page')}</p>
            {page.isSelected && <Badge variant="default">{language === 'vi' ? 'Mặc định' : 'Default'}</Badge>}
            <Badge variant={page.readiness === 'ready' ? 'default' : 'outline'}>
              {page.readiness === 'ready'
                ? language === 'vi' ? 'Trang sẵn sàng' : 'Page Ready'
                : page.readiness === 'missing_permissions'
                  ? language === 'vi' ? 'Thiếu quyền' : 'Missing Permissions'
                  : page.readiness === 'not_selected'
                    ? language === 'vi' ? 'Chưa chọn' : 'Not Selected'
                    : language === 'vi' ? 'Không rõ' : 'Unknown'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {language === 'vi' ? 'Mã Trang' : 'Page ID'}: {maskIdentifier(page.pageId)}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'vi' ? 'Danh mục' : 'Category'}: {page.category ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'vi' ? 'Tài khoản nguồn' : 'Source Account'}: {page.sourceAccountName} · DB #{page.sourceAccountDbId}
          </p>
          <p className="text-xs text-muted-foreground">
            {page.lastFetchedAt
              ? `${language === 'vi' ? 'Lần tải gần nhất' : 'Last fetched'}: ${new Date(page.lastFetchedAt).toLocaleString()}`
              : language === 'vi' ? 'Chưa có thời gian tải gần nhất' : 'Last fetched time unavailable'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={page.isSelected ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onSetDefault(page)}
          disabled={working || page.isSelected}
        >
          {page.isSelected ? (language === 'vi' ? 'Trang mặc định' : 'Default Page') : (language === 'vi' ? 'Đặt làm mặc định' : 'Set as Default')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefreshSourceAccount(page.sourceAccountDbId)}
          disabled={working}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {language === 'vi' ? 'Làm mới Trang' : 'Refresh Pages'}
        </Button>
        <Button variant="outline" size="sm" disabled>
          {language === 'vi' ? 'Xem chi tiết' : 'View Details'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onForgetLocalPage(page)}
          disabled={working}
        >
          {language === 'vi' ? 'Quên Trang cục bộ' : 'Forget Local Page'}
        </Button>
      </div>
    </div>
  );
}

function AccountCard({
  account,
  working,
  language,
  onRefresh,
  onDisconnect,
}: {
  account: AccountSnapshot;
  working: boolean;
  language: 'vi' | 'en';
  onRefresh: (accountId: number) => void;
  onDisconnect: (accountId: number) => void;
}) {
  return (
    <div className="so9-surface flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <Facebook className="h-5 w-5 text-blue-500" />
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{account.accountName}</p>
            <Badge variant={statusVariant(account.status)}>{statusLabel(account.status, language)}</Badge>
            <Badge variant={tokenHealthVariant(account.tokenHealth)}>
              {account.tokenHealth === 'healthy'
                ? language === 'vi' ? 'Ổn định' : 'healthy'
                : account.tokenHealth === 'expiring'
                  ? language === 'vi' ? 'Sắp hết hạn' : 'expiring'
                  : account.tokenHealth === 'expired'
                    ? language === 'vi' ? 'Hết hạn' : 'expired'
                    : account.tokenHealth === 'missing'
                      ? language === 'vi' ? 'Thiếu' : 'missing'
                      : language === 'vi' ? 'không rõ' : 'unknown'}
            </Badge>
            <Badge variant={account.isSimulation ? 'secondary' : 'outline'}>
              {account.isSimulation ? (language === 'vi' ? 'Mô phỏng' : 'Simulation') : (language === 'vi' ? 'Thật' : 'Real')}
            </Badge>
          </div>
           <p className="text-sm text-muted-foreground">
             {account.platform} · {maskIdentifier(account.accountId)} · DB #{account.id}
           </p>
           <p className="text-xs text-muted-foreground">
             {account.tokenExpiresAt
               ? `${language === 'vi' ? 'Token hết hạn lúc' : 'Token expires'}: ${new Date(account.tokenExpiresAt).toLocaleString()}`
               : language === 'vi' ? 'Chưa có thời gian hết hạn token' : 'No token expiry set'}
           </p>

          {!account.isSimulation && account.platform === 'facebook' && (
            <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
              {account.pageReadiness === 'ready' ? (
                <div className="space-y-1">
                  <p className="font-medium text-green-700">{language === 'vi' ? 'Trang sẵn sàng' : 'Page Ready'}</p>
                  <p>
                    {language === 'vi' ? 'Trang đã chọn' : 'Selected Page'}: <span className="font-medium">{account.selectedPageName ?? (language === 'vi' ? 'Trang chưa đặt tên' : 'Unnamed Page')}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {language === 'vi' ? 'Danh mục' : 'Category'}: {account.selectedPageCategory ?? (language === 'vi' ? 'Không rõ' : 'Unknown')}
                  </p>
                  <p className="text-muted-foreground">
                    {language === 'vi' ? 'Mã Trang' : 'Page ID'}: {maskIdentifier(account.selectedPageId)}
                  </p>
                </div>
              ) : account.pageReadiness === 'missing_permissions' ? (
                <div className="space-y-1">
                  <p className="font-medium text-amber-700">{language === 'vi' ? 'Sẵn sàng của Trang: Thiếu quyền' : 'Page Readiness: Missing permissions'}</p>
                  <p className="text-muted-foreground">{language === 'vi' ? 'Thiếu:' : 'Missing:'}</p>
                  <ul className="list-disc pl-5 text-muted-foreground">
                    {(account.permissionsMissing ?? []).map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                </div>
              ) : account.pageReadiness === 'not_selected' ? (
                <div className="space-y-1">
                  <p className="font-medium">{language === 'vi' ? 'Sẵn sàng của Trang: Chưa chọn' : 'Page Readiness: Not selected'}</p>
                  <p className="text-muted-foreground">
                    {language === 'vi' ? 'Chưa có Trang Facebook nào được lưu là Trang đã chọn.' : 'No selected Facebook Page is stored yet.'}
                  </p>
                </div>
              ) : null}
            </div>
          )}
         </div>
       </div>

       <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRefresh(account.id)}
          disabled={working}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {language === 'vi' ? 'Làm mới trạng thái' : 'Refresh Status'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDisconnect(account.id)}
          disabled={working}
        >
          <Unplug className="mr-2 h-4 w-4" />
          {language === 'vi' ? 'Ngắt kết nối' : 'Disconnect'}
        </Button>
      </div>
    </div>
  );
}

 export function AccountsPage() {
   const electronAPI = getElectronAPI();
   const navigate = useNavigate();
   const { language } = useLanguageStore();
   const [accounts, setAccounts] = useState<AccountSnapshot[]>([]);
   const [connectionStatus, setConnectionStatus] =
     useState<AccountConnectionStatusSnapshot | null>(null);
   const [loading, setLoading] = useState(true);
   const [working, setWorking] = useState(false);
   const [statusMessage, setStatusMessage] = useState<string | null>(null);
   const [showConnectionPanel, setShowConnectionPanel] = useState(false);
   const [showFacebookOAuthModal, setShowFacebookOAuthModal] = useState(false);
   const [facebookOAuthUrl, setFacebookOAuthUrl] = useState('');
   const [facebookOAuthState, setFacebookOAuthState] = useState<string | null>(null);
   const [facebookCallbackUrl, setFacebookCallbackUrl] = useState('');
   const [isCompletingFacebookOAuth, setIsCompletingFacebookOAuth] = useState(false);
   const facebookOAuthCompletionRef = useRef(false);

  const loadData = async () => {
    try {
      setStatusMessage(null);
      const [accountsData, connectionStatusData] = await Promise.all([
        electronAPI.accounts.list(),
        electronAPI.accounts.getConnectionStatus(),
      ]);
      console.info(
        '[AccountsPage] electronAPI available',
        JSON.stringify({ available: !!window.electronAPI }, null, 2)
      );
      console.info(
        '[AccountsPage] facebook config status received',
        JSON.stringify(
          {
            configured: connectionStatusData.facebook.configured,
            valid: connectionStatusData.facebook.valid,
            appIdMasked: connectionStatusData.facebook.appIdMasked,
            graphApiVersion: connectionStatusData.facebook.graphApiVersion,
            status: connectionStatusData.facebook.status,
            statusLabel: connectionStatusData.facebook.statusLabel,
          },
          null,
          2
        )
      );
      setAccounts(accountsData);
      setConnectionStatus(connectionStatusData);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể tải dữ liệu tài khoản' : 'Failed to load account data'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const healthyAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.status === 'active' &&
          account.tokenHealth !== 'expired' &&
          account.tokenHealth !== 'missing'
      ).length,
    [accounts]
  );

  const attentionAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.status !== 'active' ||
          account.tokenHealth === 'expired' ||
          account.tokenHealth === 'missing'
      ).length,
    [accounts]
  );

   const handleConnectFacebook = async () => {
     try {
       setWorking(true);
       setStatusMessage(null);
       const result = await electronAPI.accounts.startFacebookOAuth();

       if (!result.ok || !result.url || !result.state) {
         setShowFacebookOAuthModal(false);
         setFacebookOAuthUrl('');
         setFacebookOAuthState(null);
         setStatusMessage(
           result.message ?? 'Facebook connection is unavailable right now.'
         );
         return;
       }

       setFacebookOAuthUrl(result.url);
       setFacebookOAuthState(result.state);
       setFacebookCallbackUrl('');
       facebookOAuthCompletionRef.current = false;
       setIsCompletingFacebookOAuth(false);
       setShowFacebookOAuthModal(true);
       setStatusMessage(result.message ?? 'Facebook authorization URL is ready.');
     } catch (error) {
       setStatusMessage(
         error instanceof Error ? error.message : 'Failed to start Facebook connection'
       );
     } finally {
       setWorking(false);
     }
   };

   const handleCopyFacebookOAuthUrl = async () => {
     if (!facebookOAuthUrl) {
       return;
     }

     try {
       await navigator.clipboard.writeText(facebookOAuthUrl);
       setStatusMessage('Facebook OAuth URL copied to clipboard.');
     } catch {
       setStatusMessage('Unable to copy the Facebook OAuth URL.');
     }
   };

   const handleOpenFacebookOAuthUrl = async () => {
     if (!facebookOAuthUrl) {
       return;
     }
 
     try {
       const result = await electronAPI.oauth.openExternalUrl(facebookOAuthUrl);
 
       if (!result?.ok) {
         throw new Error(result?.error || 'Unable to open the Facebook OAuth URL.');
       }
 
       setStatusMessage('Facebook OAuth URL opened manually in your browser.');
     } catch (error) {
       setStatusMessage(
         error instanceof Error ? error.message : 'Unable to open the Facebook OAuth URL.'
       );
     }
   };

   const handleCancelFacebookOAuth = async () => {
     try {
       setWorking(true);
       const result = await electronAPI.accounts.cancelFacebookOAuth({
         state: facebookOAuthState,
       });
       facebookOAuthCompletionRef.current = false;
       setIsCompletingFacebookOAuth(false);
       setShowFacebookOAuthModal(false);
       setFacebookOAuthUrl('');
       setFacebookOAuthState(null);
       setFacebookCallbackUrl('');
       setStatusMessage(
         result.success ? 'Facebook OAuth session cancelled.' : result.error ?? 'Failed to cancel Facebook connection'
       );
     } catch (error) {
       setStatusMessage(
         error instanceof Error ? error.message : 'Failed to cancel Facebook connection'
       );
     } finally {
       setWorking(false);
     }
   };

   const handleSubmitFacebookCallback = async () => {
     if (facebookOAuthCompletionRef.current || isCompletingFacebookOAuth) {
       return;
     }

     try {
       facebookOAuthCompletionRef.current = true;
       setIsCompletingFacebookOAuth(true);
       setWorking(true);

       const { code, state } = parseFacebookCallbackUrl(facebookCallbackUrl);

       if (state !== facebookOAuthState) {
         throw new Error(
           'Callback state does not match the current Facebook OAuth session. Start again and use the latest URL.'
         );
       }

       const result = await electronAPI.accounts.completeFacebookOAuth({ code, state });

       if (!result.success) {
         throw new Error(
           result.error ? toSafeErrorString(result.error) : 'Facebook account connection failed.'
         );
       }

       facebookOAuthCompletionRef.current = false;
       setIsCompletingFacebookOAuth(false);
       setShowFacebookOAuthModal(false);
       setFacebookOAuthUrl('');
       setFacebookOAuthState(null);
       setFacebookCallbackUrl('');
       setStatusMessage(
         result.account
           ? `Connected ${result.account.accountName} successfully.`
           : 'Facebook account connected successfully.'
       );
       await loadData();
     } catch (error) {
       facebookOAuthCompletionRef.current = false;
       setIsCompletingFacebookOAuth(false);
       setStatusMessage(toSafeErrorString(error));
     } finally {
       setWorking(false);
     }
   };

   const handleCreateMockFacebookAccount = async () => {
    try {
      setWorking(true);
      const result = await electronAPI.accounts.createMockFacebookAccount();
      await loadData();
      setStatusMessage(
        result.created
          ? `Simulation Facebook account created: ${result.account.accountName}`
          : `Using existing simulation Facebook account: ${result.account.accountName}`
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : 'Failed to create simulation Facebook account'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRefreshAccount = async (accountId: number) => {
    try {
      setWorking(true);
      const refreshed = await electronAPI.accounts.refresh(accountId);
      await loadData();
      setStatusMessage(
        refreshed
          ? 'Account health refreshed successfully.'
          : 'Account requires reconnect, has an expired token, or Facebook config is invalid.'
      );
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to refresh account');
    } finally {
      setWorking(false);
    }
  };

  const handleDisconnectAccount = async (accountId: number) => {
    try {
      setWorking(true);
      await electronAPI.accounts.disconnect(accountId);
      await loadData();
      setStatusMessage('Account disconnected.');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Failed to disconnect account');
    } finally {
      setWorking(false);
    }
  };

   const authorizedFacebookPages = useMemo<FacebookPageSnapshot[]>(() => {
     const explicitPages = accounts
       .filter((account) => !account.isSimulation && account.platform === 'facebook')
       .flatMap((account) => account.authorizedPages ?? []);

     if (explicitPages.length > 0) {
       return explicitPages;
     }

     return accounts
       .filter(
         (account) =>
           !account.isSimulation &&
           account.platform === 'facebook' &&
           !!account.selectedPageId
       )
       .map<FacebookPageSnapshot>((account) => ({
         accountId: account.id,
         pageId: account.selectedPageId ?? '',
         pageName: account.selectedPageName ?? 'Selected Facebook Page',
         category: account.selectedPageCategory ?? null,
         pictureUrl: null,
         isSelected: true,
         readiness:
           account.pageReadiness === 'missing_permissions'
             ? 'missing_permissions'
             : 'ready',
         lastFetchedAt: account.pagesLastFetchedAt ?? null,
         sourceAccountName: account.accountName,
         sourceAccountDbId: account.id,
       }));
   }, [accounts]);

   const handleSetFacebookSelectedPage = async (page: FacebookPageSnapshot) => {
     try {
       setWorking(true);
       const updated = await electronAPI.accounts.setFacebookSelectedPage({
         accountId: page.accountId,
         pageId: page.pageId,
       });
       await loadData();
       setStatusMessage(
         updated
           ? `Default Facebook Page updated to ${page.pageName ?? 'selected page'}.`
           : 'Unable to update the default Facebook Page.'
       );
     } catch (error) {
       setStatusMessage(
         error instanceof Error ? error.message : 'Failed to update the default Facebook Page'
       );
     } finally {
       setWorking(false);
     }
   };

   const handleForgetFacebookPage = async (page: FacebookPageSnapshot) => {
     try {
       setWorking(true);
       const removed = await electronAPI.accounts.forgetFacebookPage({
         accountId: page.accountId,
         pageId: page.pageId,
       });
       await loadData();
       setStatusMessage(
         removed
           ? `Local Facebook Page data removed for ${page.pageName ?? 'page'}.`
           : 'Unable to remove local Facebook Page data.'
       );
     } catch (error) {
       setStatusMessage(
         error instanceof Error ? error.message : 'Failed to forget the local Facebook Page'
       );
     } finally {
       setWorking(false);
     }
   };

   const callbackReady = facebookCallbackUrl.trim().length > 0;

   return (
     <div className="so9-page">
      <section className="so9-page-header">
        <div className="so9-page-header-copy">
          <p className="so9-page-eyebrow">{language === 'vi' ? 'Kênh kết nối' : 'Connected channels'}</p>
          <h2 className="so9-page-title">{language === 'vi' ? 'Danh tính và trạng thái kết nối Facebook' : 'Facebook identity and connection health'}</h2>
          <p className="so9-page-description">
            {language === 'vi'
              ? 'Theo dõi danh tính Facebook đã kết nối, tình trạng token, mức sẵn sàng của kênh/Trang và mở nhanh sang Kết nối kênh để quản lý chi tiết.'
              : 'Track the connected Facebook identity, token health, channel/Page readiness, and jump quickly into Connected Channels for detailed management.'}
          </p>
        </div>
        <div className="so9-page-actions">
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/connected-channels')}>
            {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => navigate('/create-post')}>
            {language === 'vi' ? 'Mở Đăng bài viết' : 'Open Create Post'}
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => setShowConnectionPanel((value) => !value)}>
            <Plus className="mr-2 h-4 w-4" />
            {language === 'vi' ? 'Thêm tài khoản' : 'Add Account'}
          </Button>
          <Button
            className="rounded-full"
            onClick={handleConnectFacebook}
            disabled={working || !connectionStatus?.facebook.valid}
          >
            <Facebook className="mr-2 h-4 w-4" />
            {language === 'vi' ? 'Kết nối Facebook' : 'Connect Facebook'}
          </Button>
        </div>
      </section>

      <FacebookOAuthModal
        open={showFacebookOAuthModal}
        oauthUrl={facebookOAuthUrl}
        callbackUrl={facebookCallbackUrl}
        callbackReady={callbackReady}
        statusMessage={showFacebookOAuthModal ? statusMessage : null}
        working={working}
        language={language}
        onCallbackUrlChange={setFacebookCallbackUrl}
        onCopyUrl={handleCopyFacebookOAuthUrl}
        onOpenUrl={handleOpenFacebookOAuthUrl}
        onSubmit={handleSubmitFacebookCallback}
        onCancel={handleCancelFacebookOAuth}
      />

      <FacebookSetupPanel
        connectionStatus={connectionStatus}
        actionMessage={!showConnectionPanel ? statusMessage : null}
        working={working}
        language={language}
        onConnectFacebook={handleConnectFacebook}
        onCreateMockAccount={handleCreateMockFacebookAccount}
      />

      <AccountConnectionPanel
        open={showConnectionPanel}
        connectionStatus={connectionStatus}
        actionMessage={statusMessage}
        working={working}
        language={language}
        onClose={() => setShowConnectionPanel(false)}
        onConnectFacebook={handleConnectFacebook}
        onCreateMockAccount={handleCreateMockFacebookAccount}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="so9-kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Danh tính đã kết nối' : 'Connected identities'}</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
              <p className="text-xs text-muted-foreground">
                {language === 'vi' ? 'Các danh tính Facebook hiện có trong ứng dụng' : 'Facebook identities currently available in the app'}
              </p>
          </CardContent>
        </Card>

        <Card className="so9-kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Sẵn sàng hằng ngày' : 'Daily-ready accounts'}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{healthyAccounts}</div>
              <p className="text-xs text-muted-foreground">
                {language === 'vi' ? 'Tài khoản đang ổn định để rà soát token và dùng tiếp cho kênh đã kết nối' : 'Accounts stable enough for token review and continued channel usage'}
              </p>
          </CardContent>
        </Card>

        <Card className="so9-kpi-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Cần chú ý' : 'Needs Attention'}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attentionAccounts}</div>
              <p className="text-xs text-muted-foreground">
                {language === 'vi' ? 'Các trạng thái hết hạn, thiếu, lỗi hoặc cần kết nối lại' : 'Expired, missing, error, or reconnect-required states'}
              </p>
          </CardContent>
        </Card>
      </div>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>Facebook</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Tách riêng lớp danh tính OAuth với danh sách kênh/Trang Facebook đã được cấp quyền để bạn rà soát đúng nơi.'
                  : 'Separate OAuth identity health from the list of authorized Facebook channels/Pages so you can review the right layer.'}
              </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="accounts" className="space-y-4">
            <TabsList className="rounded-full border border-[#dbe4f0] bg-white p-1">
              <TabsTrigger value="accounts">{language === 'vi' ? 'Tài khoản' : 'Accounts'}</TabsTrigger>
              <TabsTrigger value="pages">{language === 'vi' ? 'Kênh / Trang' : 'Channels / Pages'}</TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="space-y-4">
              {loading ? (
                <div className="so9-empty-state py-8">
                  <p className="so9-state-title mt-0 text-sm">{language === 'vi' ? 'Đang tải tài khoản…' : 'Loading accounts…'}</p>
                  <p className="so9-state-description mt-1 text-xs">
                    {language === 'vi'
                      ? 'Đang đồng bộ danh sách tài khoản và tình trạng token.'
                      : 'Syncing connected accounts and token health.'}
                  </p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="so9-empty-state py-12 text-center">
                  <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-medium">{language === 'vi' ? 'Chưa có tài khoản nào được kết nối' : 'No accounts connected'}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Hãy thêm tài khoản Facebook để xác minh danh tính OAuth, tải Trang thật và mở đường cho danh sách kênh ở bước tiếp theo.'
                      : 'Add a Facebook account to verify the OAuth identity, fetch real Pages, and unlock the channel list in the next step.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button variant="outline" onClick={() => setShowConnectionPanel(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {language === 'vi' ? 'Thêm tài khoản' : 'Add Account'}
                    </Button>
                    <Button
                      onClick={handleConnectFacebook}
                      disabled={working || !connectionStatus?.facebook.valid}
                    >
                      <Facebook className="mr-2 h-4 w-4" />
                      {language === 'vi' ? 'Kết nối Facebook' : 'Connect Facebook'}
                    </Button>
                    {connectionStatus?.simulationMode && (
                      <Button
                        variant="outline"
                        onClick={handleCreateMockFacebookAccount}
                        disabled={working}
                      >
                        {language === 'vi' ? 'Tạo tài khoản Facebook mô phỏng' : 'Create Simulation Facebook Account'}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    working={working}
                    language={language}
                    onRefresh={handleRefreshAccount}
                    onDisconnect={handleDisconnectAccount}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="pages" className="space-y-4">
              {loading ? (
                <div className="so9-empty-state py-8">
                  <p className="so9-state-title mt-0 text-sm">{language === 'vi' ? 'Đang tải các Trang đã được cấp quyền…' : 'Loading authorized Pages…'}</p>
                  <p className="so9-state-description mt-1 text-xs">
                    {language === 'vi'
                      ? 'Đang tải Trang đã cấp quyền và trạng thái sẵn sàng của từng Trang.'
                      : 'Loading authorized Pages and each Page readiness state.'}
                  </p>
                </div>
              ) : authorizedFacebookPages.length === 0 ? (
                  <div className="so9-empty-state p-6 text-center text-sm text-muted-foreground">
                    {language === 'vi' ? 'Chưa có kênh Facebook nào đã được cấp quyền được lưu.' : 'No authorized Facebook channels are stored yet.'}
                    <div className="mt-2">
                      {language === 'vi'
                        ? 'Hãy làm mới Trang bằng tài khoản có quyền Trang, kết nối lại Facebook với quyền Trang, hoặc mở Kết nối kênh để review danh sách hiện có.'
                        : 'Refresh Pages using a page-capable account, reconnect Facebook with Page permissions, or open Connected Channels to review the current list.'}
                    </div>
                    <div className="mt-4">
                      <Button variant="outline" className="rounded-full" onClick={() => navigate('/connected-channels')}>
                        {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
                    <div className="flex flex-col gap-3 rounded-[18px] border border-[#e6edf8] bg-[#fbfdff] p-4 text-sm text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-medium text-[#17233b]">
                          {language === 'vi' ? 'Tóm tắt kênh đã kết nối' : 'Connected channel summary'}
                        </p>
                        <p className="mt-1">
                          {language === 'vi'
                            ? 'Bạn có thể đặt mặc định, làm mới hoặc gỡ cục bộ tại đây; trang quản lý đầy đủ, bộ lọc và trạng thái readiness chi tiết nằm ở Kết nối kênh.'
                            : 'You can set defaults, refresh, or forget local data here; the full management view, filters, and detailed readiness states live in Connected Channels.'}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-full bg-white" onClick={() => navigate('/connected-channels')}>
                          {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
                        </Button>
                        <Button variant="outline" className="rounded-full bg-white" onClick={() => navigate('/create-post')}>
                          {language === 'vi' ? 'Mở Đăng bài viết' : 'Open Create Post'}
                        </Button>
                      </div>
                    </div>
                    {authorizedFacebookPages.map((page) => (
                  <FacebookPageCard
                    key={`${page.accountId}-${page.pageId}`}
                    page={page}
                    working={working}
                    language={language}
                    onSetDefault={handleSetFacebookSelectedPage}
                    onRefreshSourceAccount={handleRefreshAccount}
                    onForgetLocalPage={handleForgetFacebookPage}
                  />
                ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}