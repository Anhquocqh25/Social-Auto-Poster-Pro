import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Facebook,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  AccountConnectionStatusSnapshot,
  AccountSnapshot,
  FacebookPageSnapshot,
  FacebookPageTargetOption,
} from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';
import { useLanguageStore } from '@/store/useLanguageStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ChannelStatusKey =
  | 'all'
  | 'ready'
  | 'reconnect_required'
  | 'missing_permissions'
  | 'expiring'
  | 'unavailable';

type ChannelTypeKey = 'all' | 'page' | 'group';

interface ConnectedChannelRow {
  key: string;
  pageId: string;
  pageName: string;
  category: string | null;
  pictureUrl: string | null;
  accountId: number;
  sourceAccountName: string;
  sourceAccountDbId: number;
  connectedAccountAvatar: string | null;
  readiness: FacebookPageSnapshot['readiness'] | FacebookPageTargetOption['pageReadiness'];
  accountStatus: string;
  tokenHealth: AccountSnapshot['tokenHealth'];
  statusKey: Exclude<ChannelStatusKey, 'all'>;
  statusLabel: string;
  statusTone: 'success' | 'warning' | 'destructive' | 'outline';
  typeLabel: string;
  platformLabel: string;
  connectionHelp: string;
}

function maskIdentifier(value: string) {
  if (!value) return '—';
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function avatarFallback(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'CH';
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function getChannelStatusMeta(
  row: Pick<ConnectedChannelRow, 'readiness' | 'accountStatus' | 'tokenHealth'>,
  language: 'vi' | 'en'
) {
  if (row.accountStatus !== 'active') {
    return {
      statusKey: 'reconnect_required' as const,
      statusLabel: language === 'vi' ? 'Cần kết nối lại' : 'Reconnect required',
      statusTone: 'warning' as const,
      connectionHelp:
        language === 'vi'
          ? 'Tài khoản nguồn không còn hoạt động ổn định. Hãy kết nối lại trong Tài khoản Facebook.'
          : 'The source account is no longer in a healthy active state. Reconnect it in Facebook Accounts.',
    };
  }

  if (row.tokenHealth === 'expired' || row.tokenHealth === 'expiring') {
    return {
      statusKey: 'expiring' as const,
      statusLabel: language === 'vi' ? 'Token sắp hết hạn' : 'Token expiring',
      statusTone: 'warning' as const,
      connectionHelp:
        language === 'vi'
          ? 'Quyền truy cập của tài khoản nguồn cần được làm mới sớm.'
          : 'The source account access needs to be refreshed soon.',
    };
  }

  if (row.readiness === 'missing_permissions') {
    return {
      statusKey: 'missing_permissions' as const,
      statusLabel: language === 'vi' ? 'Thiếu quyền' : 'Missing permissions',
      statusTone: 'destructive' as const,
      connectionHelp:
        language === 'vi'
          ? 'Trang này chưa đủ quyền cần thiết để đăng thật an toàn.'
          : 'This Page is missing required permissions for safe real publishing.',
    };
  }

  if (row.readiness === 'ready') {
    return {
      statusKey: 'ready' as const,
      statusLabel: language === 'vi' ? 'Sẵn sàng' : 'Ready',
      statusTone: 'success' as const,
      connectionHelp:
        language === 'vi'
          ? 'Kênh này sẵn sàng cho draft, lịch đăng và review publish có kiểm soát.'
          : 'This channel is ready for drafts, scheduling, and controlled publish review.',
    };
  }

  return {
    statusKey: 'unavailable' as const,
    statusLabel: language === 'vi' ? 'Không khả dụng' : 'Unavailable',
    statusTone: 'outline' as const,
    connectionHelp:
      language === 'vi'
        ? 'Kênh này hiện chưa thể dùng để đăng. Hãy kiểm tra lại trạng thái kết nối.'
        : 'This channel cannot be used for publishing right now. Check its connection state.',
  };
}

export function ConnectedChannelsPage() {
  const navigate = useNavigate();
  const electronAPI = getElectronAPI();
  const { language } = useLanguageStore();

  const [accounts, setAccounts] = useState<AccountSnapshot[]>([]);
  const [pageTargets, setPageTargets] = useState<FacebookPageTargetOption[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<AccountConnectionStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook'>('all');
  const [typeFilter, setTypeFilter] = useState<ChannelTypeKey>('all');
  const [statusFilter, setStatusFilter] = useState<ChannelStatusKey>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | string>('all');

  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ConnectedChannelRow | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const [accountResult, pagesResult, statusResult] = await Promise.all([
        electronAPI.accounts.list(),
        electronAPI.accounts.listFacebookPageTargets(),
        electronAPI.accounts.getConnectionStatus(),
      ]);
      setAccounts(accountResult);
      setPageTargets(pagesResult);
      setConnectionStatus(statusResult);
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể tải danh sách kênh đã kết nối.'
            : 'Failed to load connected channels.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [language]);

  const connectedFacebookAccounts = useMemo(
    () => accounts.filter((account) => account.platform === 'facebook'),
    [accounts]
  );

  const channelRows = useMemo<ConnectedChannelRow[]>(() => {
    const accountMap = new Map(connectedFacebookAccounts.map((account) => [account.id, account]));
    const rows = pageTargets.map((page) => {
      const sourceAccount =
        accountMap.get(page.sourceAccountId) ??
        connectedFacebookAccounts.find((account) => account.accountId === String(page.sourceAccountId)) ??
        null;

      const statusMeta = getChannelStatusMeta(
          {
            readiness: page.pageReadiness,
            accountStatus: sourceAccount?.status ?? 'unknown',
            tokenHealth: sourceAccount?.tokenHealth,
          },
        language
      );

      return {
        key: `${page.sourceAccountId}-${page.pageId}`,
        pageId: page.pageId,
        pageName:
          page.pageName ??
          (language === 'vi' ? 'Trang Facebook chưa đặt tên' : 'Unnamed Facebook Page'),
        category: page.category,
        pictureUrl:
          page.pictureUrl ??
          sourceAccount?.authorizedPages?.find((item) => item.pageId === page.pageId)?.pictureUrl ??
          null,
        accountId: page.sourceAccountId,
        sourceAccountName: page.sourceAccountName,
        sourceAccountDbId: page.sourceAccountDbId,
        connectedAccountAvatar: sourceAccount?.avatarUrl ?? null,
        readiness: page.pageReadiness,
        accountStatus: sourceAccount?.status ?? 'unknown',
        tokenHealth: sourceAccount?.tokenHealth,
        statusKey: statusMeta.statusKey,
        statusLabel: statusMeta.statusLabel,
        statusTone: statusMeta.statusTone,
        typeLabel: language === 'vi' ? 'Trang' : 'Page',
        platformLabel: 'Facebook',
        connectionHelp: statusMeta.connectionHelp,
      };
    });

    return rows.sort((a, b) => a.pageName.localeCompare(b.pageName));
  }, [connectedFacebookAccounts, language, pageTargets]);

  const filteredChannels = useMemo(() => {
    return channelRows.filter((row) => {
      const matchesSearch =
        row.pageName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.sourceAccountName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPlatform = platformFilter === 'all' || row.platformLabel.toLowerCase() === platformFilter;
      const matchesType = typeFilter === 'all' || (typeFilter === 'page' && row.typeLabel.toLowerCase() === (language === 'vi' ? 'trang' : 'page').toLowerCase());
      const matchesStatus = statusFilter === 'all' || row.statusKey === statusFilter;
      const matchesAccount = accountFilter === 'all' || String(row.accountId) === accountFilter;

      return matchesSearch && matchesPlatform && matchesType && matchesStatus && matchesAccount;
    });
  }, [accountFilter, channelRows, language, platformFilter, searchQuery, statusFilter, typeFilter]);

  const summary = useMemo(() => {
    return {
      total: channelRows.length,
      ready: channelRows.filter((row) => row.statusKey === 'ready').length,
      reconnect: channelRows.filter((row) => row.statusKey === 'reconnect_required').length,
      missingPermissions: channelRows.filter((row) => row.statusKey === 'missing_permissions').length,
    };
  }, [channelRows]);

  const handleCheckConnection = async (row: ConnectedChannelRow) => {
    try {
      setActionLoadingKey(`check-${row.key}`);
      setStatusMessage(null);
      await electronAPI.accounts.refresh(row.accountId);
      setStatusMessage(
        language === 'vi'
          ? `Đã yêu cầu kiểm tra lại kết nối cho "${row.pageName}".`
          : `Connection check requested for "${row.pageName}".`
      );
      await loadData();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể kiểm tra kết nối.'
            : 'Failed to check the connection.'
      );
    } finally {
      setActionLoadingKey(null);
      setActiveActionMenu(null);
    }
  };

  const handleReconnect = (row: ConnectedChannelRow) => {
    setActiveActionMenu(null);
    setStatusMessage(
      language === 'vi'
        ? `Hãy dùng lại luồng kết nối Facebook trong mục Tài khoản Facebook để làm mới "${row.pageName}".`
        : `Use the Facebook Accounts connection flow to refresh "${row.pageName}".`
    );
    navigate('/accounts');
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      setActionLoadingKey(`remove-${removeTarget.key}`);
      setStatusMessage(null);
      const removed = await electronAPI.accounts.forgetFacebookPage({
        accountId: removeTarget.accountId,
        pageId: removeTarget.pageId,
      });
      setStatusMessage(
        removed
          ? language === 'vi'
            ? `Đã gỡ "${removeTarget.pageName}" khỏi ứng dụng.`
            : `"${removeTarget.pageName}" was removed from the app.`
          : language === 'vi'
            ? 'Không thể gỡ kênh khỏi ứng dụng.'
            : 'Failed to remove the channel from the app.'
      );
      setRemoveTarget(null);
      await loadData();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : language === 'vi'
            ? 'Không thể gỡ kênh khỏi ứng dụng.'
            : 'Failed to remove the channel from the app.'
      );
    } finally {
      setActionLoadingKey(null);
    }
  };

  const hasConnectedAccounts = connectedFacebookAccounts.length > 0;
  const realPublishingEnabled = Boolean(connectionStatus?.facebook.realPublishingEnabled);

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">
          {language === 'vi' ? 'Kết nối kênh · dữ liệu Facebook Page thật' : 'Connected channels · real Facebook Page data'}
        </p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">{language === 'vi' ? 'Kênh đang kết nối' : 'Connected Channels'}</h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Chỉ hiển thị các Trang Facebook thật đang được ứng dụng lưu và đồng bộ. Bạn có thể xem avatar Trang, avatar tài khoản kết nối, trạng thái sẵn sàng và các thao tác cục bộ an toàn mà không tạo hàng giả.'
                : 'Shows only real Facebook Pages currently stored and synced by the app. Review Page avatars, connected-account avatars, readiness, and safe local actions without any synthetic rows.'}
            </p>
            <div className="so9-hero-actions">
              <Button className="h-11 rounded-full bg-white px-5 text-[#12338f] hover:bg-[#f5f8ff]" onClick={() => navigate('/accounts')}>
                <Link2 className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Thêm kênh' : 'Add Channel'}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/16"
                onClick={() => navigate('/accounts')}
              >
                <Users className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Mở Tài khoản Facebook' : 'Open Facebook Accounts'}
              </Button>
            </div>
          </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:w-[430px] xl:grid-cols-2">
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {language === 'vi' ? 'Kênh sẵn sàng' : 'Ready channels'}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">{summary.ready}</p>
              </div>
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  {language === 'vi' ? 'Thiếu quyền / cần kết nối lại' : 'Missing permissions / reconnect'}
                </p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {summary.missingPermissions} / {summary.reconnect}
                </p>
              </div>
            </div>
        </div>
      </section>

      <section className={`so9-banner ${realPublishingEnabled ? 'so9-banner-danger' : 'so9-banner-success'}`}>
        <div className="flex items-start gap-3">
          {realPublishingEnabled ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">
              {realPublishingEnabled
                ? language === 'vi'
                  ? 'Đăng thật đang bật trong phiên kiểm thử có kiểm soát.'
                  : 'Real publishing is enabled for a controlled test session.'
                : language === 'vi'
                  ? 'Đăng thật đang tắt — các thao tác đăng Facebook thật đang được chặn an toàn.'
                  : 'Real publishing is off — real Facebook publish actions are safely blocked.'}
            </p>
            <p className="text-sm">
              {language === 'vi'
                ? 'Mỗi lần lưu, lên lịch hoặc đăng đều phải tự chọn kênh rõ ràng trong Create Post và Bulk Create.'
                : 'Each save, schedule, or publish action now requires an explicit channel choice in Create Post and Bulk Create.'}
            </p>
            <p className="text-sm">
              {language === 'vi'
                ? 'Nút “Thêm kênh” luôn chuyển sang luồng Tài khoản Facebook hiện có để kết nối tài khoản và tải Trang thật.'
                : 'The “Add Channel” action always routes into the existing Facebook Accounts flow to connect an account and load real Pages.'}
            </p>
          </div>
        </div>
      </section>

      {statusMessage ? (
        <section className="so9-banner so9-banner-info">
          <p>{statusMessage}</p>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="so9-kpi-card">
          <CardContent className="p-5">
            <p className="so9-kpi-label">{language === 'vi' ? 'Tổng số kênh' : 'Total Channels'}</p>
            <p className="so9-kpi-value">{summary.total}</p>
          </CardContent>
        </Card>
        <Card className="so9-kpi-card">
          <CardContent className="p-5">
            <p className="so9-kpi-label">{language === 'vi' ? 'Sẵn sàng' : 'Ready'}</p>
            <p className="so9-kpi-value">{summary.ready}</p>
          </CardContent>
        </Card>
        <Card className="so9-kpi-card">
          <CardContent className="p-5">
            <p className="so9-kpi-label">{language === 'vi' ? 'Cần kết nối lại' : 'Reconnect Required'}</p>
            <p className="so9-kpi-value">{summary.reconnect}</p>
          </CardContent>
        </Card>
         <Card className="so9-kpi-card">
          <CardContent className="p-5">
            <p className="so9-kpi-label">{language === 'vi' ? 'Thiếu quyền' : 'Missing Permissions'}</p>
            <p className="so9-kpi-value">{summary.missingPermissions}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Bộ lọc kênh' : 'Channel Filters'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Tìm nhanh kênh, tài khoản nguồn và trạng thái sẵn sàng cho công việc đăng bài hằng ngày.'
              : 'Quickly search channels, source accounts, and readiness states for everyday publishing work.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1.4fr)_repeat(4,minmax(0,1fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#7b8aa2]" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={language === 'vi' ? 'Tìm theo tên kênh hoặc tài khoản...' : 'Search by channel or account name...'}
                className="pl-10"
              />
            </div>

            <select className="so9-field" value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value as 'all' | 'facebook')}>
              <option value="all">{language === 'vi' ? 'Tất cả nền tảng' : 'All platforms'}</option>
              <option value="facebook">Facebook</option>
            </select>

            <select className="so9-field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ChannelTypeKey)}>
              <option value="all">{language === 'vi' ? 'Tất cả loại' : 'All types'}</option>
              <option value="page">{language === 'vi' ? 'Trang' : 'Page'}</option>
              <option value="group">{language === 'vi' ? 'Nhóm (chưa hỗ trợ)' : 'Group (unsupported)'}</option>
            </select>

            <select className="so9-field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ChannelStatusKey)}>
              <option value="all">{language === 'vi' ? 'Tất cả trạng thái' : 'All statuses'}</option>
              <option value="ready">{language === 'vi' ? 'Sẵn sàng' : 'Ready'}</option>
              <option value="reconnect_required">{language === 'vi' ? 'Cần kết nối lại' : 'Reconnect required'}</option>
              <option value="missing_permissions">{language === 'vi' ? 'Thiếu quyền' : 'Missing permissions'}</option>
              <option value="expiring">{language === 'vi' ? 'Token sắp hết hạn' : 'Token expiring'}</option>
              <option value="unavailable">{language === 'vi' ? 'Không khả dụng' : 'Unavailable'}</option>
            </select>

            <select className="so9-field" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
              <option value="all">{language === 'vi' ? 'Tất cả tài khoản' : 'All accounts'}</option>
              {connectedFacebookAccounts.map((account) => (
                <option key={account.id} value={String(account.id)}>
                  {account.accountName}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{language === 'vi' ? 'Danh sách kênh' : 'Channel List'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Hiển thị dữ liệu Facebook Page thật đang được lưu trong ứng dụng: avatar Trang, tên, trạng thái sẵn sàng, tài khoản nguồn và các thao tác cục bộ an toàn. Không tạo hàng ảo hoặc fake success.'
                  : 'Displays real Facebook Page data stored by the app: Page avatar, page name, readiness, source account, and safe local actions. No synthetic rows or fake success states are created.'}
              </CardDescription>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => void loadData()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Làm mới' : 'Refresh'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {!hasConnectedAccounts ? (
              <div className="so9-empty-state">
                <div className="so9-state-icon">
                  <Users className="h-7 w-7 text-[#1f5eff]" />
                </div>
                <h3 className="so9-state-title">
                  {language === 'vi' ? 'Chưa có kênh nào được kết nối.' : 'No channels connected yet.'}
                </h3>
                <p className="so9-state-description">
                  {language === 'vi'
                    ? 'Kết nối tài khoản Facebook để tải danh sách Trang của bạn và chọn kênh rõ ràng trong Đăng bài viết hoặc Đăng hàng loạt.'
                    : 'Connect a Facebook account to load your Pages and choose channels explicitly in Create Post or Bulk Create.'}
                </p>
                <div className="so9-state-actions">
                  <button type="button" className="so9-state-action" onClick={() => navigate('/accounts')}>
                    {language === 'vi' ? 'Mở Tài khoản Facebook' : 'Open Facebook Accounts'}
                  </button>
                  <button type="button" className="so9-state-action" onClick={() => navigate('/create-post')}>
                    {language === 'vi' ? 'Mở Đăng bài viết' : 'Open Create Post'}
                  </button>
                </div>
              </div>
          ) : loading ? (
            <div className="so9-loading-state">
              <div className="so9-state-icon">
                <RefreshCw className="h-7 w-7 animate-spin text-[#1f5eff]" />
              </div>
              <h3 className="so9-state-title">{language === 'vi' ? 'Đang tải kênh đã kết nối…' : 'Loading connected channels…'}</h3>
            </div>
          ) : filteredChannels.length === 0 ? (
            <div className="so9-empty-state">
              <div className="so9-state-icon">
                <Search className="h-7 w-7 text-[#1f5eff]" />
              </div>
              <h3 className="so9-state-title">{language === 'vi' ? 'Không có kênh phù hợp' : 'No matching channels'}</h3>
              <p className="so9-state-description">
                {language === 'vi'
                  ? 'Hãy điều chỉnh từ khóa hoặc bộ lọc để xem thêm kênh.'
                  : 'Adjust the search query or filters to see more channels.'}
              </p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e8eef8] text-left text-[#6c7b92]">
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Chọn' : 'Select'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Tên kênh' : 'Channel Name'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Nền tảng' : 'Platform'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Loại' : 'Type'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Tài khoản kết nối' : 'Connected Account'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Trạng thái' : 'Status'}</th>
                      <th className="px-3 py-3 font-semibold">{language === 'vi' ? 'Thao tác' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredChannels.map((row) => {
                      const loadingRow = actionLoadingKey?.includes(row.key);
                      return (
                        <tr key={row.key} className="border-b border-[#eef3fa] align-top last:border-b-0">
                          <td className="px-3 py-4">
                            <input
                              type="checkbox"
                              checked={row.statusKey === 'ready'}
                              readOnly
                              aria-label={row.pageName}
                            />
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#eaf1ff] text-[#1f5eff]">
                                {row.pictureUrl ? (
                                  <img src={row.pictureUrl} alt={row.pageName} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-semibold">{avatarFallback(row.pageName)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-semibold text-[#17233b]">{row.pageName}</p>
                                </div>
                                <p className="mt-1 text-xs text-[#6c7b92]">
                                  {row.category ?? (language === 'vi' ? 'Không rõ danh mục' : 'Unknown category')} · {maskIdentifier(row.pageId)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <Badge variant="outline" className="normal-case tracking-normal">
                              <Facebook className="mr-1 h-3.5 w-3.5 text-[#1877f2]" />
                              {row.platformLabel}
                            </Badge>
                          </td>
                          <td className="px-3 py-4">{row.typeLabel}</td>
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eef2f8] text-[#52627a]">
                                {row.connectedAccountAvatar ? (
                                  <img src={row.connectedAccountAvatar} alt={row.sourceAccountName} className="h-full w-full object-cover" />
                                ) : (
                                  <span className="text-xs font-semibold">{avatarFallback(row.sourceAccountName)}</span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[#17233b]">{row.sourceAccountName}</p>
                                <p className="truncate text-xs text-[#6c7b92]">DB #{row.sourceAccountDbId}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="space-y-2">
                              <Badge variant={row.statusTone} className="normal-case tracking-normal">
                                {row.statusTone === 'success' ? (
                                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                                ) : row.statusTone === 'warning' ? (
                                  <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                                ) : row.statusTone === 'destructive' ? (
                                  <XCircle className="mr-1 h-3.5 w-3.5" />
                                ) : (
                                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                                )}
                                {row.statusLabel}
                              </Badge>
                              <p className="max-w-[220px] text-xs leading-5 text-[#6c7b92]">{row.connectionHelp}</p>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="rounded-full"
                                onClick={() => setActiveActionMenu((current) => (current === row.key ? null : row.key))}
                                disabled={Boolean(loadingRow)}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>

                              {activeActionMenu === row.key ? (
                                <div className="absolute right-0 z-10 mt-2 w-60 rounded-[18px] border border-[#dbe4f0] bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[#17233b] hover:bg-[#f5f8ff]"
                                    onClick={() => navigate('/posts')}
                                  >
                                    <span>{language === 'vi' ? 'Xem chi tiết' : 'View Details'}</span>
                                    <ChevronRight className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[#17233b] hover:bg-[#f5f8ff]"
                                    onClick={() => void handleCheckConnection(row)}
                                  >
                                    <span>{language === 'vi' ? 'Kiểm tra kết nối' : 'Check Connection'}</span>
                                    <RefreshCw className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[#17233b] hover:bg-[#f5f8ff]"
                                    onClick={() => handleReconnect(row)}
                                  >
                                    <span>{language === 'vi' ? 'Kết nối lại' : 'Reconnect'}</span>
                                    <Link2 className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex w-full items-center justify-between rounded-[14px] px-3 py-2 text-left text-sm text-[#a0362e] hover:bg-[#fff4f2]"
                                    onClick={() => {
                                      setRemoveTarget(row);
                                      setActiveActionMenu(null);
                                    }}
                                  >
                                    <span>{language === 'vi' ? 'Gỡ khỏi ứng dụng' : 'Remove from App'}</span>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 lg:hidden">
                {filteredChannels.map((row) => (
                  <div key={row.key} className="so9-channel-row">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="so9-channel-avatar">
                          {row.pictureUrl ? (
                            <img src={row.pictureUrl} alt={row.pageName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-semibold">{avatarFallback(row.pageName)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[#17233b]">{row.pageName}</p>
                          </div>
                          <p className="mt-1 truncate text-xs text-[#6c7b92]">
                            {row.category ?? (language === 'vi' ? 'Không rõ danh mục' : 'Unknown category')} · {maskIdentifier(row.pageId)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={row.statusTone} className="normal-case tracking-normal">
                        {row.statusLabel}
                      </Badge>
                    </div>

                    <div className="so9-inline-meta mt-4">
                      <span>{language === 'vi' ? 'Nền tảng' : 'Platform'}: {row.platformLabel}</span>
                      <span className="so9-inline-separator" />
                      <span>{language === 'vi' ? 'Loại' : 'Type'}: {row.typeLabel}</span>
                      <span className="so9-inline-separator" />
                      <span>{language === 'vi' ? 'Tài khoản kết nối' : 'Connected account'}: {row.sourceAccountName}</span>
                    </div>

                    <div className="mt-3 rounded-[18px] border border-[#e6edf8] bg-white p-3 text-sm text-[#52627a]">
                      <p className="font-medium text-[#17233b]">
                        {language === 'vi' ? 'Trạng thái kết nối' : 'Connection status'}
                      </p>
                      <p className="mt-1 leading-6">{row.connectionHelp}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => void handleCheckConnection(row)}>
                        {language === 'vi' ? 'Kiểm tra' : 'Check'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleReconnect(row)}>
                        {language === 'vi' ? 'Kết nối lại' : 'Reconnect'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate('/posts')}>
                        {language === 'vi' ? 'Xem bài viết' : 'View posts'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setRemoveTarget(row)}>
                        {language === 'vi' ? 'Gỡ khỏi app' : 'Remove'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="rounded-[20px] border border-dashed border-[#dbe4f0] bg-[#fbfdff] p-4 text-sm text-[#61718a]">
            <p className="font-semibold text-[#17233b]">{language === 'vi' ? 'Phạm vi hiển thị kênh' : 'Channel visibility scope'}</p>
            <p className="mt-1">
              {language === 'vi'
                ? 'Trang này chỉ hiển thị dữ liệu Trang Facebook thật đã được ứng dụng lưu. Backend hiện chưa hỗ trợ Nhóm Facebook như một kênh đăng thật, vì vậy ứng dụng không giả lập dữ liệu Nhóm, không fake readiness và không tạo publish result ảo.'
                : 'This page only shows real Facebook Page data already stored by the app. The backend does not currently support Facebook Groups as real publishing channels, so the app does not fabricate Group rows, readiness, or publish outcomes.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {removeTarget ? (
        <div className="so9-modal-shell">
          <Card className="so9-modal-card max-w-lg shadow-2xl">
            <CardHeader className="so9-modal-header">
              <CardTitle>{language === 'vi' ? 'Gỡ kênh khỏi ứng dụng?' : 'Remove this channel from the app?'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Thao tác này chỉ gỡ kênh khỏi ứng dụng. Nó không xóa Trang trên Facebook.'
                  : 'This only removes the channel from the app. It does not delete the Page on Facebook.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="so9-modal-body space-y-4">
              <div className="rounded-[18px] border border-[#e8eef8] bg-[#fbfdff] p-4 text-sm text-[#52627a]">
                <p className="font-semibold text-[#17233b]">{removeTarget.pageName}</p>
                <p className="mt-1">{language === 'vi' ? 'Tài khoản nguồn' : 'Connected account'}: {removeTarget.sourceAccountName}</p>
              </div>
              <div className="so9-modal-footer border-0 px-0 pb-0 pt-0">
                <Button variant="outline" onClick={() => setRemoveTarget(null)}>
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </Button>
                <Button variant="destructive" onClick={() => void handleRemove()} disabled={Boolean(actionLoadingKey)}>
                  {language === 'vi' ? 'Gỡ khỏi ứng dụng' : 'Remove from App'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}