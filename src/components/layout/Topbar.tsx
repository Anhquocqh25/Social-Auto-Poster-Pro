import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Menu,
  Moon,
  Sun,
  Trash2,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
  Globe2,
  Link2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useThemeStore } from '@/store/useThemeStore';
import { useLanguageStore } from '@/store/useLanguageStore';
import { getElectronAPI } from '@/lib/electronApi';
import { t } from '@/lib/i18n';
import type { AccountConnectionStatusSnapshot, DiagnosticsSnapshot } from '@/types/electron';

type NotificationItem = DiagnosticsSnapshot['notifications'][number];

function notificationVariant(type: NotificationItem['type']) {
  switch (type) {
    case 'success':
      return 'success';
    case 'warning':
      return 'warning';
    case 'failure':
      return 'destructive';
    default:
      return 'outline';
  }
}

function NotificationIcon({ type }: { type: NotificationItem['type'] }) {
  switch (type) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'failure':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Info className="h-4 w-4 text-blue-500" />;
  }
}

function getNotificationTarget(notification: NotificationItem) {
  const title = notification.title.toLowerCase();
  const message = notification.message.toLowerCase();

  if (title.includes('publish') || message.includes('post #')) {
    return '/posts';
  }

  if (title.includes('scheduler') || message.includes('queued') || message.includes('recovered')) {
    return '/diagnostics';
  }

  if (title.includes('account') || title.includes('token') || message.includes('token')) {
    return '/accounts';
  }

  return null;
}

function getRouteMeta(pathname: string, language: 'vi' | 'en') {
  if (pathname === '/') {
    return {
      eyebrow: language === 'vi' ? 'Trang chủ' : 'Dashboard',
      title: language === 'vi' ? 'Tổng quan cá nhân' : 'Personal Dashboard',
      description:
        language === 'vi'
          ? 'Theo dõi nhanh bài đăng, lịch xử lý và tình trạng kênh kết nối.'
          : 'Quickly track posts, scheduled work, and connected channel health.',
    };
  }

  if (pathname.startsWith('/create-post')) {
    return {
      eyebrow: language === 'vi' ? 'Đăng bài viết' : 'Create Post',
      title: language === 'vi' ? 'Soạn nội dung để đăng' : 'Compose a publishing post',
      description:
        language === 'vi'
          ? 'Ưu tiên video, ảnh và văn bản với lựa chọn kênh đăng rõ ràng.'
          : 'Prioritize video, image, and text workflows with a clear publishing channel selector.',
    };
  }

  if (pathname.startsWith('/posts')) {
    return {
      eyebrow: language === 'vi' ? 'Quản lý bài đăng' : 'Posts',
      title: language === 'vi' ? 'Thư viện bài đăng' : 'Post Library',
      description:
        language === 'vi'
          ? 'Theo dõi trạng thái, attempt timeline và review an toàn theo từng kênh.'
          : 'Track status, attempt timelines, and safe review per publishing channel.',
    };
  }

  if (pathname.startsWith('/connected-channels')) {
    return {
      eyebrow: language === 'vi' ? 'Kết nối kênh' : 'Connected Channels',
      title: language === 'vi' ? 'Kênh đang kết nối' : 'Connected Channels',
      description:
        language === 'vi'
          ? 'Quản lý các kênh Facebook đã kết nối, trạng thái sẵn sàng và thao tác cục bộ an toàn.'
          : 'Manage connected Facebook channels, readiness states, and safe local actions.',
    };
  }

  if (pathname.startsWith('/bulk-create')) {
    return {
      eyebrow: language === 'vi' ? 'Đăng hàng loạt' : 'Bulk Create',
      title: language === 'vi' ? 'Chuẩn bị nội dung hàng loạt' : 'Prepare bulk content',
      description:
        language === 'vi'
          ? 'Áp dụng cùng một trải nghiệm chọn kênh cho nhiều dòng nội dung.'
          : 'Use the same channel-aware workflow across multiple content rows.',
    };
  }

  if (pathname.startsWith('/accounts')) {
    return {
      eyebrow: language === 'vi' ? 'Tài khoản Facebook' : 'Facebook Accounts',
      title: language === 'vi' ? 'Danh tính và trạng thái kết nối' : 'Identity and connection health',
      description:
        language === 'vi'
          ? 'Theo dõi danh tính Facebook đã kết nối, độ sẵn sàng và mở nhanh sang Kết nối kênh.'
          : 'Track the connected Facebook identity, readiness, and jump quickly into Connected Channels.',
    };
  }

  if (pathname.startsWith('/diagnostics')) {
    return {
      eyebrow: language === 'vi' ? 'Chẩn đoán' : 'Diagnostics',
      title: language === 'vi' ? 'Tình trạng runtime an toàn' : 'Safe runtime diagnostics',
      description:
        language === 'vi'
          ? 'Theo dõi queue, scheduler và tín hiệu vận hành đã được làm sạch.'
          : 'Monitor queue, scheduler, and sanitized runtime operating signals.',
    };
  }

  if (pathname.startsWith('/settings')) {
    return {
      eyebrow: language === 'vi' ? 'Cài đặt' : 'Settings',
      title: language === 'vi' ? 'Thiết lập cá nhân' : 'Personal settings',
      description:
        language === 'vi'
          ? 'Ngôn ngữ, chế độ an toàn, dữ liệu ứng dụng và các lối tắt quản trị hằng ngày.'
          : 'Language, safe mode, app data guidance, and everyday administration shortcuts.',
    };
  }

  return {
    eyebrow: language === 'vi' ? 'Social Auto Poster Pro' : 'Social Auto Poster Pro',
    title: 'Social Auto Poster Pro',
    description:
      language === 'vi'
        ? 'Không gian quản lý nội dung Facebook Page cho cá nhân.'
        : 'A personal Facebook Page content management workspace.',
  };
}

export function Topbar({
  onToggleSidebar,
  showMenuButton = false,
  isSidebarOpen = false,
}: {
  onToggleSidebar?: () => void;
  showMenuButton?: boolean;
  isSidebarOpen?: boolean;
}) {
  const { theme, toggleTheme } = useThemeStore();
  const { language, setLanguage } = useLanguageStore();
  const navigate = useNavigate();
  const location = useLocation();
  const electronAPI = getElectronAPI();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState<boolean>(false);
  const [connectionStatusLoaded, setConnectionStatusLoaded] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<AccountConnectionStatusSnapshot | null>(null);

  const loadNotifications = async (unreadOnly = false) => {
    try {
      setLoadingNotifications(true);
      const result = await electronAPI.notifications.list({
        page: 1,
        limit: 25,
        unreadOnly,
      });
      setNotifications(result.notifications);

      const unreadNotifications = await electronAPI.notifications.getUnread();
      setUnreadCount(unreadNotifications.length);
      setStatusMessage(null);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('failedToLoadNotifications', language));
    } finally {
      setLoadingNotifications(false);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      const result = await electronAPI.accounts.getConnectionStatus();
      setConnectionStatus(result);
      setRealPublishingEnabled(Boolean(result.facebook.realPublishingEnabled));
      setConnectionStatusLoaded(true);
    } catch {
      setRealPublishingEnabled(false);
      setConnectionStatusLoaded(false);
      setConnectionStatus(null);
    }
  };

  useEffect(() => {
    void loadNotifications(false);
    void loadConnectionStatus();
  }, [language]);

  const handleToggleNotifications = async () => {
    const nextOpen = !showNotifications;
    setShowNotifications(nextOpen);

    if (nextOpen) {
      await loadNotifications(false);
    }
  };

  const handleMarkRead = async (notificationId: number) => {
    try {
      await electronAPI.notifications.markRead(notificationId);
      await loadNotifications(false);
      setStatusMessage(t('notificationMarkedRead', language));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('failedToMarkNotificationRead', language));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await electronAPI.notifications.markAllRead();
      await loadNotifications(false);
      setStatusMessage(t('notificationsMarkedRead', language));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('failedToMarkNotificationsRead', language));
    }
  };

  const handleDeleteNotification = async (notificationId: number) => {
    try {
      await electronAPI.notifications.delete(notificationId);
      await loadNotifications(false);
      setStatusMessage(t('notificationCleared', language));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('failedToClearNotification', language));
    }
  };

  const handleClearAll = async () => {
    try {
      await electronAPI.notifications.clearAll();
      await loadNotifications(false);
      setStatusMessage(t('allNotificationsCleared', language));
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : t('failedToClearNotifications', language));
    }
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await handleMarkRead(notification.id);
    }

    const target = getNotificationTarget(notification);
    if (target) {
      setShowNotifications(false);
      navigate(target);
    }
  };

  const routeMeta = useMemo(
    () => getRouteMeta(location.pathname, language),
    [language, location.pathname]
  );

  const safetyLabel = useMemo(() => {
    if (realPublishingEnabled) {
      return language === 'vi' ? 'Đăng thật: Đang bật' : 'Real publishing: On';
    }

    return language === 'vi' ? 'Đăng thật: Đang tắt' : 'Real publishing: Off';
  }, [language, realPublishingEnabled]);

  const safetyHelp = useMemo(() => {
    if (realPublishingEnabled) {
      return language === 'vi'
        ? 'Cảnh báo: Chỉ dùng trong phiên kiểm thử được kiểm soát.'
        : 'Warning: use only in an explicitly controlled test session.';
    }

    if (!connectionStatusLoaded) {
      return language === 'vi'
        ? 'Đang xác minh trạng thái an toàn.'
        : 'Checking safe publishing state.';
    }

    return language === 'vi'
      ? 'Đăng thật đang tắt — các thao tác đăng Facebook thật đang được chặn an toàn.'
      : 'Real publishing is off — real Facebook publish actions are safely blocked.';
  }, [connectionStatusLoaded, language, realPublishingEnabled]);

  const connectedIdentityLabel = useMemo(() => {
    const name = connectionStatus?.facebook.connectedAccount?.accountName;
    if (name) {
      return name;
    }

    return language === 'vi' ? 'Chưa kết nối Facebook' : 'No Facebook identity connected';
  }, [connectionStatus, language]);

  const connectionStatusLabel = useMemo(() => {
    if (connectionStatus?.facebook.connectedAccount?.accountName) {
      return language === 'vi' ? 'Danh tính hiện tại' : 'Current identity';
    }

    return language === 'vi' ? 'Kết nối Facebook' : 'Facebook connection';
  }, [connectionStatus, language]);

  return (
    <header className="so9-topbar">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {showMenuButton ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-0.5 rounded-full border-[#dbe4f0] bg-white/90"
                onClick={onToggleSidebar}
                aria-label={language === 'vi' ? 'Mở điều hướng' : 'Open navigation'}
                aria-expanded={isSidebarOpen}
              >
                <Menu className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7b8aa2]">
                {routeMeta.eyebrow}
              </p>
              <h1 className="truncate text-[20px] font-semibold text-[#17233b]">{routeMeta.title}</h1>
              <p className="mt-1 hidden max-w-3xl text-[13px] leading-6 text-[#62728b] lg:block">
                {routeMeta.description}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <Button
              variant="default"
              size="sm"
              className="rounded-full shadow-[0_12px_24px_rgba(31,94,255,0.22)]"
              onClick={() => navigate('/create-post')}
            >
              {language === 'vi' ? 'Đăng video' : 'Post video'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[#dbe4f0] bg-white/90"
              onClick={() => navigate('/connected-channels')}
            >
              <Globe2 className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Kênh kết nối' : 'Connected Channels'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[#dbe4f0] bg-white/90"
              onClick={() => navigate('/posts?status=needs_verification')}
            >
              {language === 'vi' ? 'Cần xác minh' : 'Needs verification'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium ${
              realPublishingEnabled
                ? 'border-[#ffd5d1] bg-[#fff1f0] text-[#a0362e]'
                : 'border-[#ccefe4] bg-[#edfdf7] text-[#0f6b54]'
            }`}
          >
            {realPublishingEnabled ? (
              <ShieldAlert className="h-4 w-4 shrink-0" />
            ) : (
              <ShieldCheck className="h-4 w-4 shrink-0" />
            )}
            <span className="truncate">{safetyHelp}</span>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {statusMessage ? (
              <p className="hidden max-w-[220px] truncate text-[12px] text-muted-foreground xl:block">
                {statusMessage}
              </p>
            ) : null}

            <div className="hidden items-center rounded-full border border-[#dbe4f0] bg-white/90 p-1 md:flex">
              <Button
                type="button"
                variant={language === 'vi' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setLanguage('vi')}
              >
                {t('vi', language)}
              </Button>
              <Button
                type="button"
                variant={language === 'en' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 rounded-full px-3 text-xs"
                onClick={() => setLanguage('en')}
              >
                {t('en', language)}
              </Button>
            </div>

            <div className="hidden min-w-[220px] items-center gap-3 rounded-full border border-[#dbe4f0] bg-white/90 px-3 py-2 lg:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#101827] text-sm font-semibold text-white">
                {connectedIdentityLabel.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7b8aa2]">
                    {connectionStatusLabel}
                  </p>
                  <p className="truncate text-sm font-medium text-[#17233b]">{connectedIdentityLabel}</p>
              </div>
            </div>

            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                className="relative rounded-full bg-white/60 hover:bg-white"
                onClick={handleToggleNotifications}
                title={language === 'vi' ? 'Thông báo' : 'Notifications'}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <>
                    <span className="absolute right-1 top-1 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                    </span>
                    <span className="absolute -right-2 -top-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {unreadCount}
                    </span>
                  </>
                ) : null}
              </Button>

              {showNotifications ? (
                <Card className="absolute right-0 top-14 z-50 w-[min(30rem,calc(100vw-2rem))] rounded-[24px] border-white/70 bg-white/95 shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{t('notifications', language)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('realRuntimeNotifications', language)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                          <CheckCheck className="mr-2 h-4 w-4" />
                          {t('markAllRead', language)}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleClearAll}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('clearAll', language)}
                        </Button>
                      </div>
                    </div>

                    {loadingNotifications ? (
                      <p className="text-sm text-muted-foreground">{t('loadingNotifications', language)}</p>
                    ) : notifications.length === 0 ? (
                      <div className="so9-state-card rounded-[20px] px-4 py-6">
                        <p className="so9-state-title mt-0 text-sm">
                          {language === 'vi' ? 'Chưa có thông báo mới' : 'No notifications yet'}
                        </p>
                        <p className="so9-state-description mt-1 text-xs">
                          {t('noNotificationsYet', language)}
                        </p>
                      </div>
                    ) : (
                      <div className="so9-mask-scrollbar max-h-96 space-y-3 overflow-auto pr-1">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className="rounded-[20px] border border-[#e6edf8] bg-[#fbfdff] p-3"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <button
                                type="button"
                                className="flex flex-1 items-start gap-3 text-left"
                                onClick={() => void handleNotificationClick(notification)}
                              >
                                <div className="mt-0.5">
                                  <NotificationIcon type={notification.type} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="mb-1 flex flex-wrap items-center gap-2">
                                    <p className="font-medium text-[#17233b]">{notification.title}</p>
                                    {!notification.isRead ? (
                                      <Badge variant="secondary" className="normal-case tracking-normal">
                                        {t('unread', language)}
                                      </Badge>
                                    ) : null}
                                    <Badge
                                      variant={notificationVariant(notification.type)}
                                      className="normal-case tracking-normal"
                                    >
                                      {notification.type}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    {new Date(notification.createdAt).toLocaleString()}
                                  </p>
                                </div>
                              </button>

                              <div className="flex shrink-0 gap-2">
                                {!notification.isRead ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => void handleMarkRead(notification.id)}
                                  >
                                    {language === 'vi' ? 'Đã đọc' : 'Read'}
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => void handleDeleteNotification(notification.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : null}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/60 text-[#6b778c] hover:bg-white hover:text-[#0065ff]"
              onClick={toggleTheme}
              title={
                theme === 'dark'
                  ? language === 'vi'
                    ? 'Chuyển sang giao diện sáng'
                    : 'Switch to light mode'
                  : language === 'vi'
                    ? 'Chuyển sang giao diện tối'
                    : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-[#dbe4f0] bg-white/90 md:hidden"
              onClick={() => navigate('/create-post')}
            >
              {language === 'vi' ? 'Đăng video' : 'Post video'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="hidden rounded-full border-[#dbe4f0] bg-white/90 md:inline-flex lg:hidden"
              onClick={() => navigate('/connected-channels')}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {language === 'vi' ? 'Kênh' : 'Channels'}
            </Button>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#101827] text-sm font-semibold text-white lg:hidden">
              {connectedIdentityLabel.slice(0, 1).toUpperCase()}
            </div>

            <Badge
              variant={realPublishingEnabled ? 'destructive' : 'success'}
              className="hidden normal-case tracking-normal xl:inline-flex"
            >
              {safetyLabel}
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}