import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  RefreshCw,
  Server,
  ShieldCheck,
  TimerReset,
  Wrench,
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
import { Input } from '@/components/ui/input';
import type { AccountConnectionStatusSnapshot, DiagnosticsSnapshot } from '@/types/electron';
import { getElectronAPI } from '@/lib/electronApi';
import { statusLabel } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

function statusBadgeVariant(status: string) {
  switch (status) {
    case 'success':
    case 'healthy':
    case 'running':
      return 'default';
    case 'processing':
    case 'pending':
      return 'secondary';
    case 'failed':
    case 'error':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function DiagnosticsPage() {
  const navigate = useNavigate();
  const electronAPI = getElectronAPI();
  const { language } = useLanguageStore();
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<AccountConnectionStatusSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [jobModeFilter, setJobModeFilter] = useState('all');
  const [jobPlatformFilter, setJobPlatformFilter] = useState('all');
  const [jobSearch, setJobSearch] = useState('');
  const [jobSort, setJobSort] = useState('newest');
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);

  const loadSnapshot = async () => {
    try {
      setLoadError(null);
      const [data, status] = await Promise.all([
        electronAPI.diagnostics.getSnapshot(),
        electronAPI.accounts.getConnectionStatus(),
      ]);
      setSnapshot(data);
      setConnectionStatus(status);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể tải chẩn đoán' : 'Failed to load diagnostics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSnapshot();
  };

  const handleManualCheck = async () => {
    try {
      await electronAPI.scheduler.runManualCheck();
      await loadSnapshot();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể chạy kiểm tra scheduler' : 'Failed to run scheduler check'));
    }
  };

  const handleViewPost = (postId: number) => {
    navigate(`/posts?postId=${postId}&source=diagnostics`);
  };

  const handleClearRecentJob = async (jobId: number) => {
    const confirmed = window.confirm(
      language === 'vi'
        ? 'Thao tác này chỉ xóa bản ghi công việc cục bộ khỏi mục Chẩn đoán. Nó không xóa bài viết và không ảnh hưởng tới Facebook.'
        : 'This only clears the local job record from diagnostics. It does not delete the post or affect Facebook.'
    );

    if (!confirmed) {
      return;
    }

    try {
      const result = await electronAPI.diagnostics.clearRecentJob(jobId);
      setLoadError(result.success ? null : result.message);
      await loadSnapshot();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể xóa bản ghi công việc cục bộ.' : 'Failed to clear the local job record.'));
    }
  };

  const uptimeMinutes = Math.floor((snapshot?.uptimeMs ?? 0) / 60000);
  const schedulerState = snapshot?.scheduler.isRunning ? 'running' : 'stopped';
  const memoryUsageMb = Math.round((snapshot?.memoryUsage.heapUsed ?? 0) / (1024 * 1024));
  const realPublishingFlagSourceLabel =
    snapshot?.safeEvidence.realPublishingFlagSource === '.env.local'
      ? '.env.local'
      : snapshot?.safeEvidence.realPublishingFlagSource === '.env'
        ? '.env'
        : snapshot?.safeEvidence.realPublishingFlagSource === 'shell'
          ? language === 'vi'
            ? 'shell env'
            : 'shell env'
          : language === 'vi'
            ? 'mặc định an toàn'
            : 'safe default';

  const availablePlatforms = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return Array.from(new Set(snapshot.recentJobs.map((job) => job.platform))).sort();
  }, [snapshot]);

  const filteredRecentJobs = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const normalizedSearch = jobSearch.trim().toLowerCase();

    const filtered = snapshot.recentJobs.filter((job) => {
      if (jobStatusFilter !== 'all' && job.status !== jobStatusFilter) {
        return false;
      }

      if (jobModeFilter === 'real' && job.mode !== 'real') {
        return false;
      }

      if (jobModeFilter === 'simulation' && job.mode !== 'simulation') {
        return false;
      }

      if (jobPlatformFilter !== 'all' && job.platform !== jobPlatformFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        job.id,
        job.postId,
        job.postTitle ?? '',
        job.targetPageName ?? '',
        job.sourceAccountName ?? '',
        job.targetLabel ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    return [...filtered].sort((a, b) => {
      switch (jobSort) {
        case 'oldest':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'retryCount':
          return b.retryCount - a.retryCount;
        case 'newest':
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  }, [snapshot, jobModeFilter, jobPlatformFilter, jobSearch, jobSort, jobStatusFilter]);

  if (loading) {
    return (
      <div className="so9-page">
        <section className="so9-hero-card">
          <p className="so9-hero-kicker">{language === 'vi' ? 'Chẩn đoán · summary trước, chi tiết sau' : 'Diagnostics · summary first, details later'}</p>
          <h1 className="so9-hero-title">{language === 'vi' ? 'Chẩn đoán' : 'Diagnostics'}</h1>
          <p className="so9-hero-description">
            {language === 'vi'
              ? 'Đang tải ảnh chụp runtime cục bộ an toàn cho scheduler, queue, readiness Facebook và dữ liệu kiểm tra hằng ngày.'
              : 'Loading the safe local runtime snapshot for scheduler, queue, Facebook readiness, and day-to-day diagnostic review.'}
          </p>
        </section>
      </div>
    );
  }

  if (loadError || !snapshot || !connectionStatus) {
    return (
      <div className="so9-page">
        <section className="so9-hero-card">
          <p className="so9-hero-kicker">{language === 'vi' ? 'Chẩn đoán · cần tải lại snapshot' : 'Diagnostics · snapshot reload needed'}</p>
          <h1 className="so9-hero-title">{language === 'vi' ? 'Chẩn đoán' : 'Diagnostics'}</h1>
          <p className="so9-hero-description">
            {language === 'vi'
              ? 'Không thể tải snapshot chẩn đoán cục bộ an toàn. Hãy thử làm mới lại để kiểm tra scheduler, queue và readiness hiện tại.'
              : 'The safe local diagnostics snapshot could not be loaded. Refresh to inspect the current scheduler, queue, and readiness state.'}
          </p>
        </section>
        <Card className="so9-flat-card">
          <CardContent className="pt-6">
            <div className="so9-error-state">
              <AlertTriangle className="h-10 w-10 text-[#d6473d]" />
              <p className="so9-state-title">
                {language === 'vi' ? 'Không thể tải dữ liệu chẩn đoán' : 'Unable to load diagnostics data'}
              </p>
              <p className="so9-state-description">
                {loadError ?? (language === 'vi' ? 'Lỗi chẩn đoán không xác định' : 'Unknown diagnostics error')}
              </p>
              <div className="so9-state-actions">
                <Button className="rounded-full" onClick={handleRefresh}>
                  {language === 'vi' ? 'Thử lại' : 'Retry'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">{language === 'vi' ? 'Chẩn đoán · summary trước, chi tiết sau' : 'Diagnostics · summary first, details later'}</p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">{language === 'vi' ? 'Chẩn đoán' : 'Diagnostics'}</h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Theo dõi sức khỏe runtime hằng ngày từ tiến trình chính Electron, scheduler, queue và readiness Facebook theo cách summary-first, an toàn và không lộ dữ liệu nhạy cảm.'
                : 'Track everyday runtime health from the Electron main process, scheduler, queue, and Facebook readiness in a summary-first layout that stays safe and avoids exposing sensitive data.'}
            </p>
            <div className="so9-hero-actions">
              <Button
                variant="outline"
                className="h-11 rounded-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/16"
                onClick={() => setShowAdvancedDetails((prev) => !prev)}
              >
                {showAdvancedDetails
                  ? language === 'vi'
                    ? 'Quay về summary an toàn'
                    : 'Return to safe summary'
                  : language === 'vi'
                    ? 'Mở điều tra nâng cao'
                    : 'Open advanced investigation'}
              </Button>
              <Button variant="outline" className="h-11 rounded-full border-white/25 bg-white/10 px-5 text-white hover:bg-white/16" onClick={handleRefresh} disabled={refreshing}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {refreshing ? (language === 'vi' ? 'Đang làm mới...' : 'Refreshing...') : (language === 'vi' ? 'Làm mới trạng thái' : 'Refresh Status')}
              </Button>
              <Button className="h-11 rounded-full bg-white px-5 text-[#12338f] hover:bg-[#f5f8ff]" onClick={handleManualCheck}>
                <Wrench className="mr-2 h-4 w-4" />
                {language === 'vi' ? 'Chạy kiểm tra scheduler' : 'Run Scheduler Check'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 xl:w-[430px] xl:grid-cols-1">
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Scheduler' : 'Scheduler'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {snapshot.scheduler.isRunning ? (language === 'vi' ? 'Đang chạy' : 'Running') : (language === 'vi' ? 'Đã dừng' : 'Stopped')}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Đăng thật' : 'Real publishing'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {snapshot.safeEvidence.realPublishingEnabled ? 'ON' : 'OFF'}
              </p>
            </div>
            <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                {language === 'vi' ? 'Điều tra nâng cao' : 'Advanced details'}
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {showAdvancedDetails ? (language === 'vi' ? 'Đang mở' : 'Open') : (language === 'vi' ? 'Đang ẩn' : 'Hidden')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Scheduler' : 'Scheduler'}</CardTitle>
            <Server className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {snapshot.scheduler.isRunning ? (language === 'vi' ? 'Đang chạy' : 'Running') : (language === 'vi' ? 'Đã dừng' : 'Stopped')}
            </div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Đang kiểm tra' : 'Checking'}: {snapshot.scheduler.isChecking ? (language === 'vi' ? 'Có' : 'Yes') : (language === 'vi' ? 'Không' : 'No')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Queue chờ' : 'Queue Pending'}</CardTitle>
            <Clock3 className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.scheduler.queue.pending}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Đang xử lý' : 'Processing'}: {snapshot.scheduler.queue.processing}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Công việc lỗi' : 'Failed Jobs'}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.scheduler.queue.failed}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Lần thử lỗi' : 'Failed attempts'}: {snapshot.failedAttempts.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Khóa đang hoạt động' : 'Active Locks'}</CardTitle>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.activeLocks.length}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Đang bật chống trùng lặp' : 'Duplicate prevention active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Công việc đã khôi phục' : 'Recovered Jobs'}</CardTitle>
            <TimerReset className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.recovery.recoveredJobsCount}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Khóa đã giải phóng' : 'Locks freed'}: {snapshot.recovery.staleLocksCleaned}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Công việc bị chặn' : 'Blocked Jobs'}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{snapshot.scheduler.queue.blocked ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Bị chặn do đăng thật đang tắt / chưa sẵn sàng' : 'Real publish disabled/readiness blocked'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === 'vi' ? 'Thời gian chạy' : 'Uptime'}</CardTitle>
            <Activity className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uptimeMinutes}m</div>
            <p className="text-xs text-muted-foreground">
              {language === 'vi' ? 'Thời gian chạy tiến trình chính' : 'Main process uptime'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'vi' ? 'Bằng chứng an toàn runtime' : 'Runtime Safety Evidence'}</CardTitle>
          <CardDescription>
            {language === 'vi'
              ? 'Mặc định hiển thị summary an toàn trước. Có thể mở chi tiết nâng cao khi cần điều tra sâu hơn. Không hiển thị token, secret hoặc callback URL.'
              : 'Shows the safe summary first by default. Advanced details can be expanded for deeper investigation. No tokens, secrets, or callback URLs are displayed.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">
                {language === 'vi' ? 'Đăng thật Facebook' : 'Real publishing'}
              </p>
              <p className="text-xl font-bold">
                {snapshot.safeEvidence.realPublishingEnabled
                  ? language === 'vi'
                    ? 'Bật'
                    : 'Enabled'
                  : language === 'vi'
                    ? 'Tắt'
                    : 'Disabled'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {language === 'vi' ? 'Nguồn effective flag:' : 'Effective flag source:'} {realPublishingFlagSourceLabel}
              </p>
              {!snapshot.safeEvidence.realPublishingEnabled ? (
                <p className="mt-2 text-xs text-emerald-700">
                  {language === 'vi'
                    ? 'Safe default hiện hành vẫn là tắt đăng thật trừ khi controlled test bật rõ ràng.'
                    : 'The current safe default still keeps real publishing disabled unless a controlled test explicitly enables it.'}
                </p>
              ) : null}
              {snapshot.safeEvidence.realPublishingEnabled && (
                <p className="mt-2 text-xs text-amber-600">
                  {language === 'vi'
                    ? 'Cảnh báo: đăng thật Facebook đang bật cho controlled test hiện tại.'
                    : 'Warning: real Facebook publishing is enabled for the current controlled test.'}
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Queue health' : 'Queue health'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.queueHealth}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Scheduler health' : 'Scheduler health'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.schedulerHealth}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Khóa đang hoạt động' : 'Active lock count'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.activeLockCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Pending jobs' : 'Pending jobs'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.pendingJobCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Processing jobs' : 'Processing jobs'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.processingJobCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Failed/blocked gần đây' : 'Recent failed/blocked jobs'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.recentFailedOrBlockedJobCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Post có fb_sim_*' : 'Posts with fb_sim_* evidence'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.fbSimEvidencePostCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Video posts' : 'Video posts'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.videoPostCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Unsupported video posts' : 'Unsupported video posts'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.unsupportedVideoPostCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Video drafts' : 'Video drafts'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.videoDraftCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Video scheduled' : 'Video scheduled'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.videoScheduledCount}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Video published' : 'Video published'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.videoPublishedCount}</p>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bài viết hiệu lực cần xác minh' : 'Effective needs verification posts'}</p>
              <p className="text-xl font-bold">{snapshot.safeEvidence.effectiveNeedsVerificationCount}</p>
              <p className="mt-2 text-xs text-muted-foreground">{snapshot.safeEvidence.reminder}</p>
              <p className="mt-2 text-xs text-amber-600">
                {language === 'vi'
                  ? 'Đăng video Facebook — Facebook có thể hiển thị video mới dưới dạng Reels. App chưa xác nhận endpoint Reels riêng.'
                  : 'Facebook video publish — Facebook may show new videos as Reels. A dedicated Reels endpoint is not separately confirmed.'}
              </p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lệnh snapshot local-only' : 'Local-only snapshot command'}</p>
              <code className="mt-2 block rounded bg-muted px-3 py-2 text-xs">
                {snapshot.safeEvidence.snapshotCommand}
              </code>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {snapshot.safeEvidence.snapshotChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Tình trạng scheduler' : 'Scheduler Health'}</CardTitle>
            <CardDescription>
              {language === 'vi' ? 'Trạng thái runtime và khôi phục trực tiếp' : 'Live runtime and recovery state'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Trạng thái hiện tại' : 'Current State'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi' ? 'Trạng thái tiến trình scheduler chính' : 'Main scheduler process state'}
                  </p>
                </div>
              </div>
              <Badge variant={statusBadgeVariant(schedulerState)}>
                {schedulerState}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <TimerReset className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Bộ xử lý queue' : 'Queue Worker'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi' ? 'Trạng thái runtime của bộ xử lý queue' : 'Queue processor runtime state'}
                  </p>
                </div>
              </div>
              <Badge variant={statusBadgeVariant(snapshot.scheduler.queue.isProcessing ? 'running' : 'stopped')}>
                {snapshot.scheduler.queue.isProcessing ? 'running' : 'stopped'}
              </Badge>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Chống trùng lặp' : 'Duplicate Protection'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi' ? 'Khóa đang hoạt động và cơ chế chống trùng trong queue' : 'Active locks and queue de-duplication'}
                  </p>
                </div>
              </div>
              <Badge variant="default">{language === 'vi' ? 'Đã bật' : 'Enabled'}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bài viết lên lịch tiếp theo' : 'Next Scheduled Post'}</p>
                <p className="text-sm font-medium">
                  {snapshot.scheduler.nextScheduledPostAt
                    ? new Date(snapshot.scheduler.nextScheduledPostAt).toLocaleString()
                    : language === 'vi'
                      ? 'Không có trong queue'
                      : 'None queued'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lần chạy scheduler gần nhất' : 'Last Scheduler Run'}</p>
                <p className="text-sm font-medium">
                  {snapshot.lastRunAt
                    ? new Date(snapshot.lastRunAt).toLocaleString()
                    : language === 'vi'
                      ? 'Chưa ghi nhận'
                      : 'Not recorded'}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bài viết đã lên lịch' : 'Scheduled Posts'}</p>
                <p className="text-xl font-bold">{snapshot.scheduler.scheduledPostsCount ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lịch bị quá hạn' : 'Overdue Scheduled'}</p>
                <p className="text-xl font-bold">{snapshot.scheduler.overdueScheduledPostsCount ?? 0}</p>
              </div>
              <div className="rounded-lg border p-3 md:col-span-2">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lịch đã hủy' : 'Cancelled Scheduled'}</p>
                <p className="text-xl font-bold">{snapshot.scheduler.cancelledScheduledPostsCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === 'vi' ? 'Tình trạng cơ sở dữ liệu' : 'Database Health'}</CardTitle>
            <CardDescription>
              {language === 'vi' ? 'Chỉ số thực của cơ sở dữ liệu cục bộ' : 'Real local database metrics'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">{language === 'vi' ? 'Trạng thái cơ sở dữ liệu' : 'Database State'}</p>
                  <p className="text-sm text-muted-foreground">
                    {language === 'vi' ? 'Trạng thái truy cập SQLite' : 'SQLite access status'}
                  </p>
                </div>
              </div>
              <Badge variant={statusBadgeVariant(snapshot.database.ok ? 'healthy' : 'failed')}>
                {snapshot.database.ok
                  ? language === 'vi'
                    ? 'ổn định'
                    : 'healthy'
                  : language === 'vi'
                    ? 'lỗi'
                    : 'failed'}
              </Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bài viết' : 'Posts'}</p>
                <p className="text-xl font-bold">{snapshot.database.postCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Công việc' : 'Jobs'}</p>
                <p className="text-xl font-bold">{snapshot.database.jobCount}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thông báo' : 'Notifications'}</p>
                <p className="text-xl font-bold">{snapshot.database.notificationCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{language === 'vi' ? 'Mức sẵn sàng của Facebook' : 'Facebook Readiness'}</CardTitle>
            <CardDescription>
              {language === 'vi'
                ? 'Chỉ hiển thị các giá trị readiness an toàn. Không hiển thị token hay secret.'
                : 'Safe readiness values only. No tokens or secrets are displayed.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Đăng thật đã bật' : 'Real Publishing Enabled'}</p>
              <p className="text-xl font-bold">
                {connectionStatus.facebook.realPublishingEnabled ? 'true' : 'false'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Tài khoản đang hoạt động' : 'Account Active'}</p>
              <p className="text-xl font-bold">
                {connectionStatus.facebook.accountActive ? 'true' : 'false'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Trang đã chọn tồn tại' : 'Selected Page Exists'}</p>
              <p className="text-xl font-bold">
                {connectionStatus.facebook.selectedPageExists ? 'true' : 'false'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Page token tồn tại' : 'Page Token Exists'}</p>
              <p className="text-xl font-bold">
                {connectionStatus.facebook.pageTokenExists ? 'true' : 'false'}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Số lượng Trang' : 'Page Count'}</p>
              <p className="text-xl font-bold">{connectionStatus.facebook.pageCount}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lần tải Trang gần nhất' : 'Last Page Fetch'}</p>
              <p className="text-sm font-medium">
                {connectionStatus.facebook.pagesLastFetchedAt
                  ? new Date(connectionStatus.facebook.pagesLastFetchedAt).toLocaleString()
                  : language === 'vi'
                    ? 'Chưa ghi nhận'
                    : 'Not recorded'}
              </p>
            </div>
            <div className="rounded-lg border p-4 md:col-span-2">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Quyền bắt buộc' : 'Required Permissions'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {connectionStatus.facebook.requiredPermissions.map((permission) => {
                  const granted = connectionStatus.facebook.grantedScopes.includes(permission);
                  return (
                    <Badge key={permission} variant={granted ? 'default' : 'outline'}>
                      {permission} {granted ? (language === 'vi' ? 'đã có' : 'granted') : (language === 'vi' ? 'thiếu' : 'missing')}
                    </Badge>
                  );
                })}
              </div>
            </div>
            <div className="rounded-lg border p-4 md:col-span-2">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Trang đã chọn' : 'Selected Page'}</p>
              <p className="text-sm font-medium">
                {connectionStatus.facebook.selectedPage
                  ? `${connectionStatus.facebook.selectedPage.name ?? (language === 'vi' ? 'Trang chưa đặt tên' : 'Unnamed Page')} · ${connectionStatus.facebook.selectedPage.id}`
                  : language === 'vi'
                    ? 'Chưa chọn Trang'
                    : 'No selected page'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'vi' ? 'Mốc thời gian runtime' : 'Runtime Timestamps'}</CardTitle>
          <CardDescription>
            {language === 'vi' ? 'Các mốc thời gian của scheduler và hoạt động publish' : 'Scheduler and publish activity timeline anchors'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lần chạy scheduler gần nhất' : 'Last Scheduler Run'}</p>
            <p className="mt-1 text-sm font-medium">
              {snapshot.lastRunAt
                ? new Date(snapshot.lastRunAt).toLocaleString()
                : language === 'vi'
                  ? 'Chưa ghi nhận'
                  : 'Not recorded'}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lần publish thành công gần nhất' : 'Last Successful Publish'}</p>
            <p className="mt-1 text-sm font-medium">
              {snapshot.lastSuccessfulPublishAt
                ? new Date(snapshot.lastSuccessfulPublishAt).toLocaleString()
                : language === 'vi'
                  ? 'Chưa có publish thành công'
                  : 'No successful publish yet'}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Lần publish lỗi gần nhất' : 'Last Failed Publish'}</p>
            <p className="mt-1 text-sm font-medium">
              {snapshot.lastFailedPublishAt
                ? new Date(snapshot.lastFailedPublishAt).toLocaleString()
                : language === 'vi'
                  ? 'Chưa có publish lỗi'
                  : 'No failed publish yet'}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thời điểm làm mới snapshot' : 'Snapshot Refreshed'}</p>
            <p className="mt-1 text-sm font-medium">
              {new Date(snapshot.refreshedAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{language === 'vi' ? 'Bộ nhớ tiến trình' : 'Process Memory Usage'}</CardTitle>
          <CardDescription>
            {language === 'vi' ? 'Mức sử dụng bộ nhớ của tiến trình chính để theo dõi runtime' : 'Main-process memory visibility for runtime monitoring'}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Heap đang dùng' : 'Heap Used'}</p>
            <p className="text-2xl font-bold">{memoryUsageMb} MB</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Tổng Heap' : 'Heap Total'}</p>
            <p className="text-2xl font-bold">
              {Math.round(snapshot.memoryUsage.heapTotal / (1024 * 1024))} MB
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">RSS</p>
            <p className="text-2xl font-bold">
              {Math.round(snapshot.memoryUsage.rss / (1024 * 1024))} MB
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bộ nhớ ngoài' : 'External'}</p>
            <p className="text-2xl font-bold">
              {Math.round(snapshot.memoryUsage.external / (1024 * 1024))} MB
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
          <CardHeader>
            <CardTitle>{language === 'vi' ? 'Bảng trạng thái queue' : 'Queue Status Panel'}</CardTitle>
            <CardDescription>
              {language === 'vi' ? 'Phân bố trạng thái queue theo runtime thực' : 'Live queue distribution across statuses'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-6">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Đang chờ' : 'Pending'}</p>
            <p className="text-2xl font-bold">{snapshot.scheduler.queue.pending}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Đang xử lý' : 'Processing'}</p>
            <p className="text-2xl font-bold">{snapshot.scheduler.queue.processing}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thành công' : 'Success'}</p>
            <p className="text-2xl font-bold">{snapshot.scheduler.queue.success}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Thất bại' : 'Failed'}</p>
            <p className="text-2xl font-bold">{snapshot.scheduler.queue.failed}</p>
          </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Đã hủy' : 'Cancelled'}</p>
              <p className="text-2xl font-bold">{snapshot.scheduler.queue.cancelled}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{language === 'vi' ? 'Bị chặn' : 'Blocked'}</p>
              <p className="text-2xl font-bold">{snapshot.scheduler.queue.blocked ?? 0}</p>
            </div>
        </CardContent>
      </Card>

      <div className="so9-info-note text-sm">
        {showAdvancedDetails
          ? language === 'vi'
            ? 'Bạn đang ở chế độ điều tra nâng cao: xem recent jobs, failed attempts, notifications, locks và timeline runtime từ dữ liệu cục bộ thực. Không có token, secret hay callback URL trong khu vực này.'
            : 'You are in advanced investigation mode: recent jobs, failed attempts, notifications, locks, and runtime timeline are shown from real local data. No tokens, secrets, or callback URLs appear in this area.'
          : language === 'vi'
            ? 'Bạn đang ở summary an toàn cho việc kiểm tra hằng ngày. Mở điều tra nâng cao khi cần soi sâu queue, timeline và các bản ghi runtime cục bộ.'
            : 'You are in the safe summary view for day-to-day checks. Open advanced investigation only when you need deeper queue, timeline, and local runtime record analysis.'}
      </div>

      {showAdvancedDetails ? (
        <>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Công việc gần đây' : 'Recent Jobs'}</CardTitle>
            <CardDescription>
              {language === 'vi' ? 'Công việc đăng trực tiếp từ cơ sở dữ liệu cục bộ' : 'Live publish jobs from the local database'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'vi' ? 'Tìm kiếm' : 'Search'}</p>
                <Input
                  value={jobSearch}
                  onChange={(event) => setJobSearch(event.target.value)}
                  placeholder={language === 'vi' ? 'Tiêu đề bài viết, mã bài viết, mã job, Trang, tài khoản...' : 'Post title, post id, job id, page, account...'}
                />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'vi' ? 'Trạng thái' : 'Status'}</p>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={jobStatusFilter}
                  onChange={(event) => setJobStatusFilter(event.target.value)}
                >
                  {['all', 'pending', 'processing', 'success', 'failed', 'cancelled', 'blocked'].map((value) => (
                    <option key={value} value={value}>
                      {value === 'all' ? (language === 'vi' ? 'Tất cả trạng thái' : 'All statuses') : statusLabel(value, language)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'vi' ? 'Chế độ' : 'Mode'}</p>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={jobModeFilter}
                  onChange={(event) => setJobModeFilter(event.target.value)}
                >
                  <option value="all">{language === 'vi' ? 'Tất cả chế độ' : 'All modes'}</option>
                  <option value="real">{language === 'vi' ? 'Facebook thật' : 'Real Facebook'}</option>
                  <option value="simulation">{language === 'vi' ? 'Mô phỏng' : 'Simulation'}</option>
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'vi' ? 'Nền tảng' : 'Platform'}</p>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={jobPlatformFilter}
                  onChange={(event) => setJobPlatformFilter(event.target.value)}
                >
                  <option value="all">{language === 'vi' ? 'Tất cả nền tảng' : 'All platforms'}</option>
                  {availablePlatforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{language === 'vi' ? 'Sắp xếp' : 'Sort'}</p>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={jobSort}
                  onChange={(event) => setJobSort(event.target.value)}
                >
                  <option value="newest">{language === 'vi' ? 'Mới nhất trước' : 'Newest first'}</option>
                  <option value="oldest">{language === 'vi' ? 'Cũ nhất trước' : 'Oldest first'}</option>
                  <option value="status">{language === 'vi' ? 'Trạng thái' : 'Status'}</option>
                  <option value="retryCount">{language === 'vi' ? 'Số lần thử lại' : 'Retry count'}</option>
                </select>
              </div>
            </div>

            {filteredRecentJobs.length === 0 ? (
              <div className="so9-empty-state py-8">
                <div className="so9-state-icon">
                  <RefreshCw className="h-6 w-6 text-[#1f5eff]" />
                </div>
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Không có công việc nào khớp với bộ lọc hiện tại.' : 'No jobs match the current filters.'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Hãy nới bộ lọc trạng thái/chế độ/nền tảng hoặc làm mới snapshot để xem thêm công việc runtime gần đây.'
                    : 'Broaden the status/mode/platform filters or refresh the snapshot to see more recent runtime jobs.'}
                </p>
              </div>
            ) : (
              filteredRecentJobs.map((job) => (
                <div
                  key={job.id}
                  className="so9-surface p-3"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {language === 'vi' ? 'Job' : 'Job'} #{job.id} · {language === 'vi' ? 'Bài viết' : 'Post'} #{job.postId} · {job.postTitle ?? (language === 'vi' ? 'Bài viết chưa có tiêu đề' : 'Untitled Post')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'vi' ? 'Trạng thái bài viết' : 'Post status'}: {statusLabel(job.postStatus, language)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={statusBadgeVariant(job.status)}>{job.status}</Badge>
                      <Badge variant={job.mode === 'simulation' ? 'secondary' : 'outline'}>
                        {job.mode === 'real' ? (language === 'vi' ? 'facebook thật' : 'real facebook') : job.mode === 'simulation' ? (language === 'vi' ? 'mô phỏng' : 'simulation') : job.mode}
                      </Badge>
                      {job.locallyCleared ? <Badge variant="outline">{language === 'vi' ? 'đã xóa cục bộ' : 'locally cleared'}</Badge> : null}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm md:grid-cols-2">
                    <div>
                      <span className="text-muted-foreground">Platform:</span> {job.platform}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Retry count:</span> {job.retryCount}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target Page:</span>{' '}
                      {job.targetPageName ?? job.targetLabel}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Source account:</span>{' '}
                      {job.sourceAccountName ?? 'Unknown source'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last attempt:</span>{' '}
                      {job.lastAttemptAt ? new Date(job.lastAttemptAt).toLocaleString() : 'Not recorded'}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Last update:</span>{' '}
                      {new Date(job.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    {job.errorMessage ?? 'No error recorded'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewPost(job.postId)}
                      >
                        {language === 'vi' ? 'Xem bài viết' : 'View Post'}
                      </Button>
                    {['failed', 'cancelled'].includes(job.status) && !job.locallyCleared ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleClearRecentJob(job.id)}
                      >
                          {language === 'vi' ? 'Xóa job cục bộ' : 'Clear Local Job'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="so9-flat-card">
          <CardHeader className="border-b border-[#e8eef8]">
            <CardTitle>{language === 'vi' ? 'Lần thử thất bại' : 'Failed Attempts'}</CardTitle>
            <CardDescription>
              {language === 'vi' ? 'Lịch sử failed attempts theo runtime thật' : 'Live failed attempt history'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.failedAttempts.length === 0 ? (
              <div className="so9-empty-state py-8">
                <div className="so9-state-icon">
                  <CheckCircle2 className="h-6 w-6 text-[#0f9d7a]" />
                </div>
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Chưa có failed attempt nào được ghi nhận.' : 'No failed attempts recorded.'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Đây thường là tín hiệu tốt. Khi runtime phát sinh lỗi thật, lịch sử failed attempts sẽ xuất hiện tại đây để điều tra.'
                    : 'This is usually a good sign. When real runtime failures happen, the failed-attempt history will appear here for investigation.'}
                </p>
              </div>
            ) : (
              snapshot.failedAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="so9-surface p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">
                      Attempt #{attempt.attemptNumber} · Job #{attempt.jobId}
                    </p>
                    <Badge variant="destructive">{attempt.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {attempt.errorMessage ?? 'Unknown error'}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(attempt.startedAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Hàng đợi thông báo' : 'Notification Queue'}</CardTitle>
          <CardDescription>
            {language === 'vi' ? 'Thông báo trong app chưa đọc từ persistence cục bộ' : 'Unread in-app notifications from persistence'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.notifications.length === 0 ? (
              <div className="so9-empty-state py-8">
                <div className="so9-state-icon">
                  <CheckCircle2 className="h-6 w-6 text-[#0f9d7a]" />
                </div>
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Không có thông báo chưa đọc.' : 'No unread notifications.'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Khi queue, scheduler hoặc publish flow cần bạn chú ý, thông báo cục bộ sẽ xuất hiện ở đây.'
                    : 'When the queue, scheduler, or publish flow needs your attention, local notifications will appear here.'}
                </p>
              </div>
          ) : (
            snapshot.notifications.map((notification) => (
              <div key={notification.id} className="so9-surface p-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-medium">{notification.title}</p>
                  <Badge variant={statusBadgeVariant(notification.type)}>{notification.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Khóa đang hoạt động' : 'Active Locks'}</CardTitle>
          <CardDescription>
            {language === 'vi' ? 'Các post locks hiện tại dùng cho cơ chế chống trùng lặp an toàn' : 'Current post locks used for duplicate-prevention safety'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot.activeLocks.length === 0 ? (
              <div className="so9-empty-state py-8">
                <div className="so9-state-icon">
                  <ShieldCheck className="h-6 w-6 text-[#0f9d7a]" />
                </div>
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Không có khóa nào đang hoạt động.' : 'No active locks.'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Queue hiện không giữ khóa chống trùng nào. Đây là trạng thái bình thường khi không có publish đang xử lý.'
                    : 'The queue is not holding any duplicate-prevention locks right now. This is normal when no publish job is being processed.'}
                </p>
              </div>
          ) : (
            snapshot.activeLocks.map((lock) => (
              <div key={lock.id} className="so9-surface p-3">
                <p className="font-medium">
                  Post #{lock.id} {lock.title ? `· ${lock.title}` : ''}
                </p>
                <p className="text-sm text-muted-foreground">
                  Locked by: {lock.lockedBy ?? 'unknown'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {lock.lockedAt ? new Date(lock.lockedAt).toLocaleString() : 'No timestamp'}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="so9-flat-card">
        <CardHeader className="border-b border-[#e8eef8]">
          <CardTitle>{language === 'vi' ? 'Timeline lần thử publish' : 'Publish Attempt Timeline'}</CardTitle>
          <CardDescription>
            {language === 'vi' ? 'Hoạt động runtime dựa trên failed attempts đã ghi nhận và trạng thái queue' : 'Runtime attempt activity based on recorded failures and queue state'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {snapshot.failedAttempts.length === 0 && snapshot.recentJobs.length === 0 ? (
              <div className="so9-empty-state py-8">
                <div className="so9-state-icon">
                  <Activity className="h-6 w-6 text-[#1f5eff]" />
                </div>
                <p className="so9-state-title mt-0 text-sm">
                  {language === 'vi' ? 'Chưa có sự kiện runtime timeline nào.' : 'No runtime timeline events yet.'}
                </p>
                <p className="so9-state-description mt-1 text-xs">
                  {language === 'vi'
                    ? 'Timeline sẽ xuất hiện khi queue bắt đầu chạy, publish attempt được ghi nhận hoặc có failed attempt cần điều tra.'
                    : 'The timeline will populate once the queue runs, publish attempts are recorded, or failed attempts require investigation.'}
                </p>
              </div>
          ) : (
            <>
              {snapshot.recentJobs.slice(0, 3).map((job) => (
                <div key={`job-${job.id}`} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">
                      Job #{job.id} currently {job.status}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Post #{job.postId} on {job.platform}
                    </p>
                  </div>
                </div>
              ))}
              {snapshot.failedAttempts.slice(0, 3).map((attempt) => (
                <div key={`attempt-${attempt.id}`} className="flex gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-red-500" />
                  <div>
                    <p className="font-medium">
                      Failed attempt #{attempt.attemptNumber} for job #{attempt.jobId}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {attempt.errorMessage ?? 'Unknown error'}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
        </>
      ) : null}
    </div>
  );
}
