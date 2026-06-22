import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Calendar as CalendarIcon,
  Users,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Video,
  Image as ImageIcon,
  FileText,
  Clock3,
  ShieldCheck,
  AlertCircle,
  CheckCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AccountSnapshot, PostSnapshot } from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';
import { statusLabel } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

function getPrimaryTarget(post: PostSnapshot) {
  return post.postTargets?.find((target) => target.targetType === 'page') ?? post.postTargets?.[0] ?? null;
}

function getWeekKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getMediaBadgeLabel(post: PostSnapshot, language: 'vi' | 'en') {
  if (post.mediaType === 'video') {
    return language === 'vi' ? 'Video' : 'Video';
  }

  if (post.mediaType === 'photo') {
    return language === 'vi' ? 'Ảnh' : 'Image';
  }

  return language === 'vi' ? 'Văn bản' : 'Text';
}

function statusVariant(status: string) {
  switch (status) {
    case 'published':
      return 'success' as const;
    case 'needs_verification':
      return 'warning' as const;
    case 'failed':
    case 'blocked':
    case 'partially_failed':
      return 'destructive' as const;
    case 'scheduled':
      return 'warning' as const;
    case 'queued':
    case 'posting':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

export function Dashboard() {
  const navigate = useNavigate();
  const electronAPI = getElectronAPI();
  const { language } = useLanguageStore();
  const [posts, setPosts] = useState<PostSnapshot[]>([]);
  const [accounts, setAccounts] = useState<AccountSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setStatusMessage(null);
        const [postResult, accountResult, connectionStatus] = await Promise.all([
          electronAPI.posts.list(),
          electronAPI.accounts.list(),
          electronAPI.accounts.getConnectionStatus(),
        ]);
        setPosts(postResult.posts);
        setAccounts(accountResult);
        setRealPublishingEnabled(Boolean(connectionStatus.facebook.realPublishingEnabled));
      } catch (error) {
        setStatusMessage(
          error instanceof Error
            ? error.message
            : language === 'vi'
              ? 'Không thể tải dữ liệu bảng tin'
              : 'Failed to load dashboard data'
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboardData();
  }, [electronAPI, language]);

  const connectedPages = useMemo(
    () => accounts.filter((account) => account.status === 'active' && account.platform === 'facebook'),
    [accounts]
  );

  const draftCount = useMemo(() => posts.filter((post) => post.status === 'draft').length, [posts]);
  const scheduledCount = useMemo(
    () => posts.filter((post) => post.status === 'scheduled').length,
    [posts]
  );
  const queueCount = useMemo(
    () => posts.filter((post) => ['queued', 'posting'].includes(post.status)).length,
    [posts]
  );
  const publishedCount = useMemo(
    () => posts.filter((post) => post.status === 'published').length,
    [posts]
  );
  const verificationCount = useMemo(
    () => posts.filter((post) => post.status === 'needs_verification').length,
    [posts]
  );
  const failedCount = useMemo(
    () => posts.filter((post) => ['failed', 'blocked', 'partially_failed'].includes(post.status)).length,
    [posts]
  );

  const scheduledPosts = useMemo(
    () => posts.filter((post) => ['scheduled', 'queued', 'posting'].includes(post.status)),
    [posts]
  );

  const recentPosts = useMemo(
    () =>
      [...posts]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5),
    [posts]
  );

  const needsVerificationPosts = useMemo(
    () =>
      posts
        .filter((post) => post.status === 'needs_verification')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [posts]
  );

  const weekDays = useMemo(() => {
    const start = new Date();
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(start);
      current.setDate(start.getDate() + index);
      return current;
    });
  }, []);

  const calendarRows = useMemo(() => {
    const channels =
      connectedPages.length > 0
        ? connectedPages.map((account) => ({
            key: `${account.platform}-${account.id}`,
            label: account.selectedPageName || account.accountName,
            items: weekDays.map((day) => {
              const count = scheduledPosts.filter((post) => {
                const primaryTarget = getPrimaryTarget(post);
                if (!primaryTarget || primaryTarget.accountId !== account.id || !post.scheduledAt) {
                  return false;
                }

                return getWeekKey(new Date(post.scheduledAt)) === getWeekKey(day);
              }).length;

              return count;
            }),
          }))
        : [
            {
              key: 'empty',
              label: language === 'vi' ? 'Chưa có kênh đã kết nối' : 'No connected channels yet',
              items: weekDays.map(() => 0),
            },
          ];

    return channels.slice(0, 4);
  }, [connectedPages, language, scheduledPosts, weekDays]);

  const statCards = [
    {
      title: language === 'vi' ? 'Kênh đã kết nối' : 'Connected Channels',
      value: connectedPages.length,
      description:
        connectedPages.length > 0
          ? language === 'vi'
            ? 'Các kênh Facebook sẵn sàng để tạo draft, lên lịch hoặc rà soát publish có kiểm soát.'
            : 'Facebook channels ready for drafts, scheduling, or controlled publish review.'
          : language === 'vi'
            ? 'Kết nối tài khoản Facebook và chọn kênh mặc định để bắt đầu.'
            : 'Connect a Facebook account and choose a default channel to get started.',
      icon: Users,
      accent: 'text-[#1f5eff]',
    },
    {
      title: language === 'vi' ? 'Bản nháp' : 'Drafts',
      value: draftCount,
      description:
        language === 'vi'
          ? 'Các bài viết đã lưu cục bộ, chưa đưa vào queue.'
          : 'Posts saved locally and not yet queued.',
      icon: FileText,
      accent: 'text-[#6b778c]',
    },
    {
      title: language === 'vi' ? 'Đã lên lịch' : 'Scheduled',
      value: scheduledCount,
      description:
        language === 'vi'
          ? 'Các bài viết đang chờ thời gian lên lịch.'
          : 'Posts waiting for their scheduled time.',
      icon: Clock3,
      accent: 'text-[#9c6b00]',
    },
    {
      title: language === 'vi' ? 'Đang chờ / Đang tải lên' : 'Queued / Uploading',
      value: queueCount,
      description:
        language === 'vi'
          ? 'Theo dõi tiến trình ở Bài viết hoặc Chẩn đoán khi cần.'
          : 'Track progress in Posts or Diagnostics when needed.',
      icon: ArrowRight,
      accent: 'text-[#1f5eff]',
    },
    {
      title: language === 'vi' ? 'Đã đăng' : 'Published',
      value: publishedCount,
      description:
        language === 'vi'
          ? 'Các bài viết có bằng chứng published an toàn trong app.'
          : 'Posts with safely recorded published evidence in the app.',
      icon: CheckCheck,
      accent: 'text-[#0f9d7a]',
    },
    {
      title: language === 'vi' ? 'Cần xác minh' : 'Needs verification',
      value: verificationCount,
      description:
        language === 'vi'
          ? 'Facebook đã phản hồi nhưng app cần bạn kiểm tra thủ công.'
          : 'Facebook responded, but the app still needs manual review.',
      icon: AlertCircle,
      accent: 'text-[#b57a00]',
    },
    {
      title: language === 'vi' ? 'Thất bại / Đã chặn' : 'Failed / Blocked',
      value: failedCount,
      description:
        language === 'vi'
          ? 'Xem lỗi an toàn và bước tiếp theo trong Bài viết.'
          : 'Review safe error details and next steps in Posts.',
      icon: AlertTriangle,
      accent: 'text-[#d6473d]',
    },
  ];

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">
          {language === 'vi' ? 'Trang chủ · điều phối hằng ngày' : 'Home · daily control center'}
        </p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">
              {language === 'vi' ? 'Tổng quan đăng bài hằng ngày' : 'Your daily publishing overview'}
            </h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Ưu tiên video Facebook trước, đồng thời vẫn theo dõi bài ảnh, bài văn bản, lịch đăng, kênh mặc định và các trạng thái cần xác minh trong một màn hình rõ ràng.'
                : 'Put Facebook video first while still tracking image posts, text posts, scheduling, the default channel, and any statuses that need manual verification in one clear screen.'}
            </p>
            <div className="so9-hero-actions">
              <Button
                className="h-11 rounded-full bg-white px-5 text-[#12338f] shadow-[0_16px_34px_rgba(15,23,42,0.18)] hover:bg-[#f5f8ff]"
                onClick={() => navigate('/create-post')}
              >
                <Video className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Đăng video' : 'Post video'}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/16"
                onClick={() => navigate('/create-post')}
              >
                <ImageIcon className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Đăng ảnh hoặc văn bản' : 'Post image or text'}
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/16"
                onClick={() => navigate('/connected-channels')}
              >
                <Users className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:w-[420px] xl:grid-cols-1">
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Kênh mặc định' : 'Default channel'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {connectedPages[0]?.selectedPageName ||
                  connectedPages[0]?.accountName ||
                  (language === 'vi' ? 'Chưa kết nối' : 'Not connected')}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Bài cần chú ý' : 'Needs attention'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {verificationCount + failedCount > 0
                  ? `${verificationCount + failedCount} ${language === 'vi' ? 'mục' : 'items'}`
                  : language === 'vi'
                    ? 'Không có mục khẩn'
                    : 'No urgent items'}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Đăng thật' : 'Real publishing'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {realPublishingEnabled ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className={`so9-banner ${realPublishingEnabled ? 'so9-banner-danger' : 'so9-banner-success'}`}
      >
        <div className="flex items-start gap-3">
          {realPublishingEnabled ? (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">
              {realPublishingEnabled
                ? language === 'vi'
                  ? 'Cảnh báo: Đăng thật đang bật'
                  : 'Warning: Real publishing is on'
                : language === 'vi'
                  ? 'Đăng thật đang tắt — chế độ an toàn'
                  : 'Real publishing is off — safe mode'}
            </p>
            <p className="mt-1 text-sm opacity-90">
              {realPublishingEnabled
                ? language === 'vi'
                  ? 'Chỉ tiếp tục trong phiên kiểm thử được kiểm soát. App không tự chỉnh cấu hình môi trường từ giao diện này.'
                  : 'Continue only in an explicitly controlled test session. The app does not silently edit environment configuration from this UI.'
                : language === 'vi'
                  ? 'Bạn có thể tạo draft, lên lịch, xem lịch sử và kiểm tra trạng thái mà không vô tình đăng thật.'
                  : 'You can create drafts, schedule posts, review history, and inspect states without accidentally publishing for real.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full bg-white/80" onClick={() => navigate('/posts?status=needs_verification')}>
            {language === 'vi' ? 'Xem bài cần xác minh' : 'Review needs-verification posts'}
          </Button>
          <Button variant="outline" className="rounded-full bg-white/80" onClick={() => navigate('/diagnostics')}>
            {language === 'vi' ? 'Mở Chẩn đoán' : 'Open Diagnostics'}
          </Button>
        </div>
      </section>

      {statusMessage && (
        <section className="so9-banner so9-banner-danger">
          <div>
            <p className="font-semibold">
              {language === 'vi' ? 'Không thể tải toàn bộ dữ liệu Dashboard' : 'Unable to load the full dashboard'}
            </p>
            <p className="mt-1 text-sm">{statusMessage}</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {statCards.map((stat) => (
            <Card key={stat.title} className="so9-kpi-card">
              <CardContent className="p-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="so9-kpi-label">{stat.title}</p>
                    <p className="so9-kpi-value">{loading ? '—' : stat.value}</p>
                    <p className="so9-kpi-help">{stat.description}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f5f8ff] p-3">
                    <stat.icon className={`h-5 w-5 ${stat.accent}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Tổng quan hôm nay' : 'Today at a glance'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Nhìn nhanh mức độ sẵn sàng hằng ngày trước khi tạo bài mới, chọn kênh đăng hoặc rà soát post đang chờ xử lý.'
                : 'Scan your daily readiness before creating a new post, choosing a channel, or reviewing posts that are waiting for action.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
              <p className="so9-muted-label">{language === 'vi' ? 'Chế độ an toàn' : 'Safety mode'}</p>
              <p className="mt-2 text-sm font-semibold text-[#17233b]">
                {realPublishingEnabled
                  ? language === 'vi'
                    ? 'Đăng thật đang bật'
                    : 'Real publishing is on'
                  : language === 'vi'
                    ? 'Đăng thật đang tắt'
                    : 'Real publishing is off'}
              </p>
            </div>
            <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
              <p className="so9-muted-label">{language === 'vi' ? 'Việc cần chú ý' : 'Needs attention'}</p>
              <p className="mt-2 text-sm font-semibold text-[#17233b]">
                {verificationCount + failedCount > 0
                  ? `${verificationCount + failedCount} ${language === 'vi' ? 'mục' : 'items'}`
                  : language === 'vi'
                    ? 'Không có mục khẩn'
                    : 'No urgent items'}
              </p>
            </div>
            <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
              <p className="so9-muted-label">{language === 'vi' ? 'Bước tiếp theo' : 'Suggested next step'}</p>
              <p className="mt-2 text-sm font-semibold text-[#17233b]">
                {connectedPages.length === 0
                  ? language === 'vi'
                    ? 'Kết nối Trang Facebook'
                    : 'Connect a Facebook Page'
                  : draftCount > 0
                    ? language === 'vi'
                      ? 'Rà soát draft gần đây'
                      : 'Review recent drafts'
                    : language === 'vi'
                      ? 'Tạo bài đăng mới'
                      : 'Create a new post'}
              </p>
            </div>
            <div className="so9-info-note text-xs">
              {language === 'vi'
                ? 'Dashboard chỉ hiển thị tín hiệu cục bộ an toàn: trạng thái bài viết, lịch đăng, kênh đã kết nối và các bước tiếp theo. Không hiển thị token hay dữ liệu bí mật.'
                : 'The dashboard only surfaces safe local signals: post status, schedule state, connected channels, and next-step guidance. Tokens and secret values are never shown here.'}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="so9-flat-card overflow-hidden">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>
              {language === 'vi' ? 'Thao tác nhanh hằng ngày' : 'Daily quick actions'}
            </CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Các lối tắt chính để đăng video, chuẩn bị nội dung, xem bài đã lên lịch và quản lý kênh kết nối.'
                : 'Primary shortcuts for posting video, preparing content, reviewing scheduled posts, and managing connected channels.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 pt-5 md:grid-cols-2">
            <button
              type="button"
              className="rounded-[22px] border border-[#cfe0ff] bg-[linear-gradient(135deg,#1f5eff_0%,#4c8dff_100%)] p-5 text-left text-white shadow-[0_16px_40px_rgba(31,94,255,0.28)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              onClick={() => navigate('/create-post')}
            >
              <Video className="h-6 w-6" />
              <p className="mt-4 text-lg font-semibold">
                {language === 'vi' ? 'Tạo bài video Facebook' : 'Create a Facebook video post'}
              </p>
              <p className="mt-2 text-sm text-white/90">
                {language === 'vi'
                  ? 'Luồng rõ ràng để chọn Trang, thêm video, nhập nội dung và kiểm tra an toàn trước khi đăng.'
                  : 'A clear flow to choose a Page, attach a video, write a caption, and review safety before publishing.'}
              </p>
            </button>

            <button
              type="button"
              className="rounded-[22px] border border-[#e1e9f7] bg-[#fbfdff] p-5 text-left transition-colors hover:border-[#1f5eff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5eff]/30"
              onClick={() => navigate('/create-post')}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#1f5eff]">
                <ImageIcon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-semibold text-[#17233b]">
                {language === 'vi' ? 'Tạo bài ảnh hoặc văn bản' : 'Create an image or text post'}
              </p>
              <p className="mt-2 text-sm text-[#62728b]">
                {language === 'vi'
                  ? 'Vẫn hỗ trợ đầy đủ các workflow quen thuộc cho ảnh và bài viết văn bản.'
                  : 'The familiar image and text workflows remain fully supported.'}
              </p>
            </button>

              <button
                type="button"
                className="rounded-[22px] border border-[#e1e9f7] bg-[#fbfdff] p-5 text-left transition-colors hover:border-[#1f5eff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5eff]/30"
                onClick={() => navigate('/posts?status=scheduled')}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#1f5eff]">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-[#17233b]">
                  {language === 'vi' ? 'Xem bài đã lên lịch' : 'View scheduled posts'}
                </p>
                <p className="mt-2 text-sm text-[#62728b]">
                  {language === 'vi'
                    ? 'Mở nhanh danh sách bài đã lên lịch hoặc đang chờ xử lý để chuẩn bị cho ngày làm việc.'
                    : 'Quickly open scheduled or waiting posts before the day’s publishing work begins.'}
                </p>
              </button>

              <button
                type="button"
                className="rounded-[22px] border border-[#e1e9f7] bg-[#fbfdff] p-5 text-left transition-colors hover:border-[#1f5eff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f5eff]/30"
                onClick={() => navigate('/connected-channels')}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#1f5eff]">
                  <Users className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-[#17233b]">
                  {language === 'vi' ? 'Quản lý kênh kết nối' : 'Manage connected channels'}
                </p>
                <p className="mt-2 text-sm text-[#62728b]">
                  {language === 'vi'
                    ? 'Kiểm tra kênh mặc định, trạng thái sẵn sàng và các thao tác kết nối lại.'
                    : 'Review the default channel, readiness states, and reconnect actions.'}
                </p>
              </button>

              <button
                type="button"
                className="rounded-[22px] border border-[#ffe3a5] bg-[#fffaf0] p-5 text-left transition-colors hover:border-[#d9a100] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d9a100]/30"
                onClick={() => navigate('/posts?status=needs_verification')}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1c4] text-[#9c6b00]">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <p className="mt-4 text-base font-semibold text-[#17233b]">
                  {language === 'vi' ? 'Xem bài cần xác minh' : 'View posts needing verification'}
                </p>
                <p className="mt-2 text-sm text-[#62728b]">
                  {language === 'vi'
                    ? 'Các bài Facebook đã phản hồi nhưng app chưa thể kết luận published cuối cùng.'
                    : 'Posts where Facebook responded but the app cannot safely conclude final published status yet.'}
                </p>
              </button>
          </CardContent>
        </Card>

        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Kênh đã kết nối' : 'Connected Channels'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Tóm tắt nhanh các kênh Facebook đang dùng trong ứng dụng mà không lộ dữ liệu nhạy cảm.'
                : 'A quick summary of the Facebook channels currently used by the app without exposing sensitive data.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="so9-empty-state py-8">
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Đang tải kênh đã kết nối…' : 'Loading connected channels…'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Đang đồng bộ trạng thái kết nối và mức sẵn sàng hằng ngày.'
                    : 'Syncing connection state and daily readiness.'}
                </p>
              </div>
            ) : connectedPages.length === 0 ? (
              <div className="so9-empty-state">
                <Users className="h-10 w-10 text-[#9baecc]" />
                <p className="so9-state-title">
                  {language === 'vi' ? 'Chưa có kênh sẵn sàng' : 'No channels are ready yet'}
                </p>
                <p className="so9-state-description">
                  {language === 'vi'
                    ? 'Kết nối tài khoản Facebook để tải danh sách Trang của bạn và chọn kênh mặc định.'
                    : 'Connect a Facebook account to load your Pages and choose a default channel.'}
                </p>
                <Button className="mt-5 rounded-full" onClick={() => navigate('/connected-channels')}>
                  {language === 'vi' ? 'Mở Kết nối kênh' : 'Open Connected Channels'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedPages.slice(0, 5).map((account) => (
                  <div key={account.id} className="so9-channel-row">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="so9-channel-avatar">
                          <span>
                            {(account.selectedPageName || account.accountName).slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-[#17233b]">
                            {account.selectedPageName || account.accountName}
                          </p>
                          <p className="mt-1 truncate text-sm text-[#62728b]">
                            {account.accountName}
                          </p>
                          <div className="so9-inline-meta mt-3">
                            <span>{language === 'vi' ? 'Nền tảng' : 'Platform'}: Facebook</span>
                            <span className="so9-inline-separator" />
                            <span>
                              {language === 'vi' ? 'Loại' : 'Type'}: {language === 'vi' ? 'Trang / Kênh' : 'Page / Channel'}
                            </span>
                            <span className="so9-inline-separator" />
                            <span>{language === 'vi' ? 'Trạng thái tài khoản' : 'Account status'}: {account.status}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="success" className="normal-case tracking-normal">
                        {language === 'vi' ? 'Sẵn sàng' : 'Ready'}
                      </Badge>
                    </div>
                  </div>
                ))}
                <Button variant="outline" className="w-full rounded-full bg-white" onClick={() => navigate('/connected-channels')}>
                  {language === 'vi' ? 'Mở toàn bộ kênh đã kết nối' : 'Open all connected channels'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Bài viết gần đây' : 'Recent posts'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Quét nhanh nội dung, trạng thái và kênh đích mà không cần đọc chi tiết kỹ thuật.'
                : 'Quickly scan content, status, and destination channel without wading through technical details.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="so9-empty-state py-8">
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Đang tải bài viết…' : 'Loading posts…'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Bảng tin đang chuẩn bị danh sách bài viết gần đây.'
                    : 'Preparing your recent post list.'}
                </p>
              </div>
            ) : recentPosts.length === 0 ? (
              <div className="so9-state-card">
                <CalendarIcon className="h-10 w-10 text-[#9baecc]" />
                <p className="so9-state-title">
                  {language === 'vi' ? 'Chưa có bài viết nào' : 'No posts yet'}
                </p>
                <p className="so9-state-description">
                  {language === 'vi'
                    ? 'Tạo bài viết đầu tiên để bắt đầu quản lý draft, lịch đăng và lịch sử đăng bài.'
                    : 'Create your first post to start managing drafts, schedules, and publishing history.'}
                </p>
                <Button className="mt-5 rounded-full" onClick={() => navigate('/create-post')}>
                  <Plus className="mr-2 h-4 w-4" />
                  {language === 'vi' ? 'Tạo bài viết đầu tiên' : 'Create your first post'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentPosts.map((post) => {
                  const primaryTarget = getPrimaryTarget(post);

                  return (
                    <div
                      key={post.id}
                      className="rounded-[22px] border border-[#e6edf8] bg-[#fcfdff] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-[#17233b]">
                              {post.title || (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled post')}
                            </p>
                            <Badge variant={statusVariant(post.status)} className="normal-case tracking-normal">
                              {statusLabel(post.status, language)}
                            </Badge>
                            <Badge variant="outline" className="normal-case tracking-normal">
                              {getMediaBadgeLabel(post, language)}
                            </Badge>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#62728b]">
                            {post.content || (language === 'vi' ? 'Chưa có nội dung văn bản.' : 'No text content yet.')}
                          </p>
                          <div className="mt-3 grid gap-2 text-xs text-[#73829a] md:grid-cols-2">
                            <span>
                              {language === 'vi' ? 'Kênh' : 'Channel'}:{' '}
                              {primaryTarget?.pageName ??
                                primaryTarget?.accountName ??
                                (language === 'vi' ? 'Chưa chọn' : 'Not selected')}
                            </span>
                            <span>
                              {post.scheduledAt
                                ? `${language === 'vi' ? 'Lên lịch' : 'Scheduled'} · ${new Date(post.scheduledAt).toLocaleString()}`
                                : `${language === 'vi' ? 'Cập nhật' : 'Updated'} · ${new Date(post.updatedAt).toLocaleString()}`}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="rounded-full bg-white"
                            onClick={() => navigate(`/posts?postId=${post.id}`)}
                          >
                            {language === 'vi' ? 'Mở chi tiết' : 'Open details'}
                          </Button>
                          <Button
                            className="rounded-full"
                            onClick={() => navigate('/posts')}
                          >
                            {language === 'vi' ? 'Mở Bài viết' : 'Open Posts'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Bài cần xác minh' : 'Needs-verification review'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Giải thích rõ các trường hợp Facebook đã phản hồi nhưng app chưa thể xác nhận published cuối cùng.'
                : 'Clearly explains cases where Facebook responded but the app cannot safely confirm final published status.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {loading ? (
              <div className="so9-state-card py-8">
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Đang tải trạng thái xác minh…' : 'Loading verification states…'}
                </p>
              </div>
            ) : needsVerificationPosts.length === 0 ? (
              <div className="so9-state-card">
                <CheckCircle2 className="h-10 w-10 text-[#0f9d7a]" />
                <p className="so9-state-title">
                  {language === 'vi' ? 'Chưa có bài nào cần xác minh' : 'No posts need verification'}
                </p>
                <p className="so9-state-description">
                  {language === 'vi'
                    ? 'Khi có trạng thái cần kiểm tra thủ công, chúng sẽ xuất hiện tại đây để bạn xem lại nhanh.'
                    : 'When a post needs manual review, it will appear here for quick follow-up.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {needsVerificationPosts.map((post) => (
                  <div key={post.id} className="rounded-[22px] border border-[#ffe3a5] bg-[#fffaf0] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-[#17233b]">
                            {post.title || (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled post')}
                          </p>
                          <Badge variant="warning" className="normal-case tracking-normal">
                            {language === 'vi' ? 'Cần xác minh' : 'Needs verification'}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-[#7a5a00]">
                          {language === 'vi'
                            ? 'Facebook đã nhận phản hồi cho bài này, nhưng app chưa có đủ bằng chứng để tự kết luận đã đăng thành công.'
                            : 'Facebook responded for this post, but the app still lacks enough evidence to safely conclude it was published successfully.'}
                        </p>
                        <p className="mt-2 text-xs text-[#8d6d10]">
                          {language === 'vi'
                            ? 'Không có fake success. Hãy mở chi tiết để xem timeline và kiểm tra thủ công trên Facebook nếu cần.'
                            : 'No fake success is assumed. Open the detail view to inspect the timeline and verify manually on Facebook if needed.'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-full bg-white"
                        onClick={() => navigate(`/posts?postId=${post.id}`)}
                      >
                        {language === 'vi' ? 'Xem lại' : 'Review'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Lịch đăng trong tuần' : 'This week’s schedule'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Bảng chỉ đọc để xem nhanh các bài đã lên lịch theo kênh và theo ngày.'
                : 'A read-only view of scheduled posts by channel and by day.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Kênh đang theo dõi' : 'Tracked Channels'}</p>
                <p className="mt-2 text-sm font-semibold text-[#17233b]">{calendarRows.length}</p>
              </div>
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Bài đã lên lịch / queue' : 'Scheduled / queued posts'}</p>
                <p className="mt-2 text-sm font-semibold text-[#17233b]">{scheduledPosts.length}</p>
              </div>
              <div className="so9-state-inline border-[#d9e7ff] bg-[#f5f9ff]">
                <p className="so9-muted-label">{language === 'vi' ? 'Chế độ xem' : 'View mode'}</p>
                <p className="mt-2 text-sm font-semibold text-[#17233b]">
                  {language === 'vi' ? 'Chỉ đọc an toàn' : 'Safe read-only'}
                </p>
              </div>
            </div>

            <div className="so9-table-wrap overflow-x-auto">
              <div className="min-w-[760px]">
                <div className="grid grid-cols-[220px_repeat(7,minmax(72px,1fr))] bg-[#f8fbff]">
                  <div className="border-r border-[#e5e9f2] px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-[#6b778c]">
                    {language === 'vi' ? 'Kênh' : 'Channel'}
                  </div>
                  {weekDays.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="border-r border-[#e5e9f2] px-3 py-3 text-center text-[12px] font-semibold uppercase tracking-wide text-[#6b778c] last:border-r-0"
                    >
                      {day.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      })}
                    </div>
                  ))}
                </div>

                {calendarRows.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[220px_repeat(7,minmax(72px,1fr))] border-t border-[#e5e9f2] bg-white"
                  >
                    <div className="border-r border-[#e5e9f2] px-4 py-3 text-[13px] font-medium text-[#172b4d]">
                      {row.label}
                    </div>
                    {row.items.map((count, index) => (
                      <div
                        key={`${row.key}-${index}`}
                        className="border-r border-[#e5e9f2] px-3 py-3 text-center text-[13px] text-[#6b778c] last:border-r-0"
                      >
                        {count > 0 ? (
                          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-[#eef4ff] px-2.5 py-1 font-semibold text-[#0065ff]">
                            {count}
                          </span>
                        ) : (
                          '—'
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}