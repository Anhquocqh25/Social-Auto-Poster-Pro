import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe2, ShieldAlert, ShieldCheck, Database, FolderOpen, Bell, Clock3, ArrowRight } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';
import { getElectronAPI } from '@/lib/electronApi';
import { t } from '@/lib/i18n';
import { useLanguageStore } from '@/store/useLanguageStore';

type SchedulerSettingsForm = {
  autoPostingEnabled: boolean;
  schedulerInterval: string;
  maxRetryAttempts: string;
  baseRetryDelay: string;
  notificationEnabled: boolean;
  logRetentionDays: string;
  simulationMode: boolean;
};

type SaveMessage = {
  type: 'success' | 'error';
  text: string;
};

export function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();
  const electronAPI = getElectronAPI();
  const { language, setLanguage } = useLanguageStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<SaveMessage | null>(null);
  const [realPublishingEnabled, setRealPublishingEnabled] = useState(false);
  const [flagSourceLabel, setFlagSourceLabel] = useState<string>('.env.local');
  const [appVersion, setAppVersion] = useState<string>('0.1.0');

  const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettingsForm>({
    autoPostingEnabled: true,
    schedulerInterval: '1',
    maxRetryAttempts: '3',
    baseRetryDelay: '1',
    notificationEnabled: true,
    logRetentionDays: '30',
    simulationMode: true,
  });

  const updateSetting = (key: keyof SchedulerSettingsForm, value: string | boolean) => {
    setSchedulerSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const loadSchedulerSettings = async () => {
    try {
      setStatusMessage(null);
      setSaveMessage(null);

      const [settings, connectionStatus] = await Promise.all([
        electronAPI.settings.getSchedulerSettings(),
        electronAPI.accounts.getConnectionStatus(),
      ]);

      setSchedulerSettings((prev) => ({
        ...prev,
        autoPostingEnabled: settings.autoPostingEnabled,
        schedulerInterval: String(settings.interval),
        maxRetryAttempts: String(settings.maxRetryAttempts),
        baseRetryDelay: String(settings.baseRetryDelay),
        notificationEnabled: settings.notificationEnabled,
        logRetentionDays: String(settings.logRetentionDays),
        simulationMode: settings.simulationMode,
      }));
      setRealPublishingEnabled(Boolean(connectionStatus.facebook.realPublishingEnabled));
      setFlagSourceLabel(connectionStatus.facebook.realPublishingFlagSource || '.env.local');
      setAppVersion(connectionStatus.facebook.graphApiVersion ? `0.1.0 · Graph ${connectionStatus.facebook.graphApiVersion}` : '0.1.0');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : (language === 'vi' ? 'Không thể tải cài đặt scheduler' : 'Failed to load scheduler settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedulerSettings();
  }, []);

  const handleSaveSchedulerSettings = async () => {
    try {
      setSaving(true);
      setStatusMessage(null);
      setSaveMessage(null);

      const interval = Number(schedulerSettings.schedulerInterval);
      const maxRetryAttempts = Number(schedulerSettings.maxRetryAttempts);
      const baseRetryDelay = Number(schedulerSettings.baseRetryDelay);
      const logRetentionDays = Number(schedulerSettings.logRetentionDays);

      if (!Number.isFinite(interval) || interval < 1) {
        setSaveMessage({
          type: 'error',
          text: language === 'vi' ? 'Chu kỳ scheduler phải là số lớn hơn hoặc bằng 1.' : 'Scheduler interval must be a number greater than or equal to 1.',
        });
        return;
      }

      if (!Number.isFinite(maxRetryAttempts) || maxRetryAttempts < 0) {
        setSaveMessage({
          type: 'error',
          text: language === 'vi' ? 'Số lần thử lại tối đa phải là số lớn hơn hoặc bằng 0.' : 'Max retry attempts must be a number greater than or equal to 0.',
        });
        return;
      }

      if (!Number.isFinite(baseRetryDelay) || baseRetryDelay < 1) {
        setSaveMessage({
          type: 'error',
          text: language === 'vi' ? 'Độ trễ thử lại cơ bản phải là số lớn hơn hoặc bằng 1.' : 'Base retry delay must be a number greater than or equal to 1.',
        });
        return;
      }

      if (!Number.isFinite(logRetentionDays) || logRetentionDays < 1) {
        setSaveMessage({
          type: 'error',
          text: language === 'vi' ? 'Số ngày lưu log phải là số lớn hơn hoặc bằng 1.' : 'Log retention must be a number greater than or equal to 1.',
        });
        return;
      }

      await electronAPI.settings.updateSchedulerSettings({
        autoPostingEnabled: schedulerSettings.autoPostingEnabled,
        interval,
        maxRetryAttempts,
        baseRetryDelay,
        notificationEnabled: schedulerSettings.notificationEnabled,
        logRetentionDays,
        simulationMode: schedulerSettings.simulationMode,
      });

      setSaveMessage({
        type: 'success',
        text: language === 'vi' ? 'Đã lưu cài đặt thành công. Thay đổi có hiệu lực ngay.' : 'Settings saved successfully. Changes take effect immediately.',
      });

      setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : (language === 'vi' ? 'Không thể lưu cài đặt scheduler' : 'Failed to save scheduler settings'),
      });
    } finally {
      setSaving(false);
    }
  };

  const safeModeTitle = useMemo(() => {
    if (realPublishingEnabled) {
      return language === 'vi' ? 'Cảnh báo: Đăng thật đang bật' : 'Warning: Real publishing is enabled';
    }

    return language === 'vi' ? 'Đăng thật đang tắt — chế độ an toàn' : 'Real publishing is off — safe mode';
  }, [language, realPublishingEnabled]);

  const safeModeDescription = useMemo(() => {
    if (realPublishingEnabled) {
      return language === 'vi'
        ? 'Chỉ dùng trong phiên kiểm thử được kiểm soát. Trang này không cho phép bật/tắt âm thầm từ giao diện.'
        : 'Use only in an explicitly controlled test session. This page does not silently toggle the mode from the UI.';
    }

    return language === 'vi'
      ? 'Bạn có thể tạo draft, lên lịch, rà soát lịch sử và chỉnh giao diện mà không vô tình đăng thật.'
      : 'You can create drafts, schedule posts, review history, and polish the UI without accidentally publishing for real.';
  }, [language, realPublishingEnabled]);

  if (loading) {
    return (
      <div className="so9-page">
        <div className="so9-page-header">
          <div className="so9-page-header-copy">
            <p className="so9-page-eyebrow">{language === 'vi' ? 'Cấu hình cá nhân' : 'Personal settings'}</p>
            <h2 className="so9-page-title">{t('settings', language)}</h2>
            <p className="so9-page-description">{language === 'vi' ? 'Đang tải cài đặt...' : 'Loading settings...'}</p>
          </div>
        </div>
        <div className="so9-loading-state">
          <div className="so9-state-icon">
            <Clock3 className="h-7 w-7 text-[#1f5eff]" />
          </div>
          <p className="so9-state-title">{language === 'vi' ? 'Đang tải cài đặt an toàn' : 'Loading safe settings'}</p>
          <p className="so9-state-description">
            {language === 'vi'
              ? 'Ứng dụng đang nạp ngôn ngữ, scheduler và trạng thái đăng thật hiệu lực.'
              : 'The app is loading language, scheduler, and effective real-publish state.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="so9-page">
      <section className="so9-hero-card">
        <p className="so9-hero-kicker">{language === 'vi' ? 'Cài đặt · safe mode & vận hành cá nhân' : 'Settings · safe mode & personal operations'}</p>
        <div className="so9-responsive-stack mt-3">
          <div className="min-w-0">
            <h1 className="so9-hero-title">{t('settings', language)}</h1>
            <p className="so9-hero-description">
              {language === 'vi'
                ? 'Quản lý ngôn ngữ, safe-mode hiện tại, nguồn cờ đăng thật hiệu lực, scheduler và hướng dẫn dữ liệu/sao lưu theo cách rõ ràng, cá nhân và không lộ bí mật kỹ thuật.'
                : 'Manage language, the current safe-mode state, the effective real-publish flag source, scheduler behavior, and data/backup guidance in a clear personal workspace without exposing technical secrets.'}
            </p>
            <div className="so9-hero-actions">
              <Badge variant={realPublishingEnabled ? 'destructive' : 'success'} className="h-11 rounded-full border-white/20 bg-white/10 px-4 text-white normal-case tracking-normal">
                {safeModeTitle}
              </Badge>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? 'Ngôn ngữ: Tiếng Việt' : 'Language: English'}
              </div>
              <div className="rounded-full border border-white/20 bg-white/10 px-4 py-3 text-sm text-white">
                {language === 'vi' ? `Nguồn cờ: ${flagSourceLabel}` : `Flag source: ${flagSourceLabel}`}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`so9-banner ${realPublishingEnabled ? 'so9-banner-warning' : 'so9-banner-success'}`}>
        <div className="flex items-start gap-3">
          {realPublishingEnabled ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-semibold">{safeModeTitle}</p>
            <p className="mt-1 text-sm">{safeModeDescription}</p>
          </div>
        </div>
        <div className="grid gap-2 text-sm">
          <div>
            <span className="font-medium">{language === 'vi' ? 'Nguồn cờ hiệu lực' : 'Effective flag source'}:</span> {flagSourceLabel}
          </div>
          <div>
            <span className="font-medium">{language === 'vi' ? 'Thông tin build' : 'Build info'}:</span> {appVersion}
          </div>
        </div>
      </section>

      {saveMessage && (
        <Card className={saveMessage.type === 'success' ? 'so9-banner so9-banner-success border-0 shadow-none' : 'so9-banner so9-banner-danger border-0 shadow-none'}>
          <CardContent className="pt-6">
            <p className="text-sm">{saveMessage.text}</p>
          </CardContent>
        </Card>
      )}

      {statusMessage && (
        <Card className="so9-banner so9-banner-danger border-0 shadow-none">
          <CardContent className="pt-6">
            <p className="text-sm">{statusMessage}</p>
          </CardContent>
        </Card>
      )}

      <section className="grid gap-4 lg:grid-cols-4">
        <Card className="so9-kpi-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="so9-kpi-label">{language === 'vi' ? 'Ngôn ngữ giao diện' : 'Interface language'}</p>
                <p className="so9-kpi-value">{language === 'vi' ? 'VI' : 'EN'}</p>
                <p className="so9-kpi-help">{language === 'vi' ? 'Chuyển nhanh ngay bên dưới.' : 'Switch instantly below.'}</p>
              </div>
              <div className="rounded-2xl bg-[#eef4ff] p-3">
                <Globe2 className="h-5 w-5 text-[#1f5eff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="so9-kpi-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="so9-kpi-label">{language === 'vi' ? 'Đăng thật' : 'Real publishing'}</p>
                <p className="so9-kpi-value">{realPublishingEnabled ? 'ON' : 'OFF'}</p>
                <p className="so9-kpi-help">{language === 'vi' ? 'Trạng thái hiệu lực hiện tại.' : 'Current effective state.'}</p>
              </div>
              <div className="rounded-2xl bg-[#eef4ff] p-3">
                {realPublishingEnabled ? <ShieldAlert className="h-5 w-5 text-[#c93d32]" /> : <ShieldCheck className="h-5 w-5 text-[#0f9d7a]" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="so9-kpi-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="so9-kpi-label">{language === 'vi' ? 'Thông báo' : 'Notifications'}</p>
                <p className="so9-kpi-value">{schedulerSettings.notificationEnabled ? 'ON' : 'OFF'}</p>
                <p className="so9-kpi-help">{language === 'vi' ? 'Thông báo trong app và desktop.' : 'In-app and desktop notifications.'}</p>
              </div>
              <div className="rounded-2xl bg-[#eef4ff] p-3">
                <Bell className="h-5 w-5 text-[#1f5eff]" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="so9-kpi-card">
          <CardContent className="p-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="so9-kpi-label">{language === 'vi' ? 'Dữ liệu cục bộ' : 'Local data'}</p>
                <p className="so9-kpi-value">SQLite</p>
                <p className="so9-kpi-help">{language === 'vi' ? 'App chỉ hiển thị hướng dẫn an toàn.' : 'The app shows safe guidance only.'}</p>
              </div>
              <div className="rounded-2xl bg-[#eef4ff] p-3">
                <Database className="h-5 w-5 text-[#1f5eff]" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="flex w-full flex-wrap justify-start gap-2 rounded-[20px] bg-transparent p-0">
          <TabsTrigger value="general">{language === 'vi' ? 'Chung' : 'General'}</TabsTrigger>
          <TabsTrigger value="scheduler">{language === 'vi' ? 'Scheduler' : 'Scheduler'}</TabsTrigger>
          <TabsTrigger value="notifications">{language === 'vi' ? 'Thông báo' : 'Notifications'}</TabsTrigger>
          <TabsTrigger value="accounts">{language === 'vi' ? 'Tài khoản' : 'Accounts'}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Giao diện và ngôn ngữ' : 'Appearance and language'}</CardTitle>
              <CardDescription>
                {language === 'vi' ? 'Giữ tiếng Việt làm mặc định hoặc chuyển nhanh sang English.' : 'Keep Vietnamese as the default or quickly switch to English.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="so9-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Ngôn ngữ' : 'Language'}</p>
                      <p className="mt-1 text-sm text-[#62728b]">
                        {language === 'vi'
                          ? 'Thay đổi ngay trong phiên làm việc và được lưu lại cho lần mở app sau.'
                          : 'Changes instantly in this session and stays saved for the next launch.'}
                      </p>
                    </div>
                    <Globe2 className="h-5 w-5 text-[#1f5eff]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant={language === 'vi' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('vi')}>
                      Tiếng Việt
                    </Button>
                    <Button variant={language === 'en' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('en')}>
                      English
                    </Button>
                  </div>
                </div>

                <div className="so9-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Chủ đề' : 'Theme'}</p>
                      <p className="mt-1 text-sm text-[#62728b]">
                        {language === 'vi' ? 'Chọn cách hiển thị phù hợp với góc làm việc của bạn.' : 'Choose the appearance that best fits your workspace.'}
                      </p>
                    </div>
                    <FolderOpen className="h-5 w-5 text-[#1f5eff]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant={theme === 'light' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('light')}>
                      {language === 'vi' ? 'Sáng' : 'Light'}
                    </Button>
                    <Button variant={theme === 'dark' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('dark')}>
                      {language === 'vi' ? 'Tối' : 'Dark'}
                    </Button>
                    <Button variant={theme === 'system' ? 'default' : 'outline'} size="sm" onClick={() => setTheme('system')}>
                      {language === 'vi' ? 'Hệ thống' : 'System'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="so9-info-note">
                  <p className="font-semibold">{language === 'vi' ? 'Hướng dẫn dữ liệu ứng dụng' : 'Application data guidance'}</p>
                  <p className="mt-1">
                    {language === 'vi'
                      ? 'Ứng dụng đang dùng dữ liệu cục bộ trong project/app hiện tại. Trang này chỉ hiển thị trạng thái an toàn, không cung cấp trình chỉnh sửa token, secret hay biến môi trường.'
                      : 'The app is using local data inside the current project/app environment. This page only surfaces safe state and does not provide any token, secret, or environment editor.'}
                  </p>
                </div>
                <div className="so9-info-note">
                  <p className="font-semibold">{language === 'vi' ? 'Hướng dẫn sao lưu an toàn' : 'Safe backup guidance'}</p>
                  <p className="mt-1">
                    {language === 'vi'
                      ? 'Nên sao lưu thư mục project và cơ sở dữ liệu SQLite trước các phiên kiểm thử lớn hoặc trước khi chạy các bước xác minh runtime. Dùng thư mục _backups để lưu snapshot theo phase.'
                      : 'Back up the project folder and SQLite database before major test sessions or runtime verification runs. Use the _backups folder to keep phase-based snapshots.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scheduler" className="space-y-4">
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Công cụ tự động đăng' : 'Auto Posting Engine'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Điều khiển chu kỳ scheduler, số lần thử lại, chế độ mô phỏng và hành vi ổn định.'
                  : 'Control scheduler interval, retries, simulation mode, and reliability behavior'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{language === 'vi' ? 'Bật tự động đăng' : 'Enable Auto Posting'}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'vi' ? 'Bật hoặc tắt scheduler chạy nền' : 'Turn the background scheduler on or off'}
                  </div>
                </div>
                <Switch
                  checked={schedulerSettings.autoPostingEnabled}
                  onCheckedChange={(checked) => updateSetting('autoPostingEnabled', checked)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="schedulerInterval">{language === 'vi' ? 'Chu kỳ scheduler (phút)' : 'Scheduler Interval (minutes)'}</Label>
                  <Input
                    id="schedulerInterval"
                    type="number"
                    min="1"
                    value={schedulerSettings.schedulerInterval}
                    onChange={(e) => updateSetting('schedulerInterval', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxRetryAttempts">{language === 'vi' ? 'Số lần thử lại tối đa' : 'Max Retry Attempts'}</Label>
                  <Input
                    id="maxRetryAttempts"
                    type="number"
                    min="0"
                    value={schedulerSettings.maxRetryAttempts}
                    onChange={(e) => updateSetting('maxRetryAttempts', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="baseRetryDelay">{language === 'vi' ? 'Độ trễ thử lại cơ bản (phút)' : 'Base Retry Delay (minutes)'}</Label>
                  <Input
                    id="baseRetryDelay"
                    type="number"
                    min="1"
                    value={schedulerSettings.baseRetryDelay}
                    onChange={(e) => updateSetting('baseRetryDelay', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logRetentionDays">{language === 'vi' ? 'Lưu log (ngày)' : 'Log Retention (days)'}</Label>
                  <Input
                    id="logRetentionDays"
                    type="number"
                    min="1"
                    value={schedulerSettings.logRetentionDays}
                    onChange={(e) => updateSetting('logRetentionDays', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{language === 'vi' ? 'Chế độ mô phỏng' : 'Simulation Mode'}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Kiểm tra đăng đã lên lịch cục bộ mà không gọi Facebook API thật'
                      : 'Test scheduled posting locally without real Facebook API calls'}
                  </div>
                </div>
                <Switch
                  checked={schedulerSettings.simulationMode}
                  onCheckedChange={(checked) => updateSetting('simulationMode', checked)}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSchedulerSettings} disabled={saving}>
                  {saving ? (language === 'vi' ? 'Đang lưu…' : 'Saving…') : (language === 'vi' ? 'Lưu cài đặt scheduler' : 'Save Scheduler Settings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Tùy chọn thông báo' : 'Notification Preferences'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Chọn mức thông báo phù hợp cho nhịp làm việc hằng ngày mà không tạo cảm giác quá tải.'
                  : 'Choose the notification level that fits your daily workflow without creating noise.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{language === 'vi' ? 'Bật thông báo' : 'Enable Notifications'}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === 'vi'
                      ? 'Công tắc chính cho thông báo trong app và desktop về tiến độ queue, lịch đăng và lỗi cần chú ý.'
                      : 'Master switch for in-app and desktop notices about queue progress, scheduled publishing, and actionable failures.'}
                  </div>
                </div>
                <Switch
                  checked={schedulerSettings.notificationEnabled}
                  onCheckedChange={(checked) => updateSetting('notificationEnabled', checked)}
                />
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveSchedulerSettings} disabled={saving}>
                  {saving ? (language === 'vi' ? 'Đang lưu…' : 'Saving…') : (language === 'vi' ? 'Lưu cài đặt thông báo' : 'Save Notification Settings')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card className="so9-flat-card">
            <CardHeader className="border-b border-[#e8eef8]">
              <CardTitle>{language === 'vi' ? 'Thông tin an toàn và ứng dụng' : 'Safe and app information'}</CardTitle>
              <CardDescription>
                {language === 'vi'
                  ? 'Tập trung vào những gì bạn cần kiểm tra hằng ngày: trạng thái an toàn, nơi lưu dữ liệu và lối tắt tới khu vực liên quan.'
                  : 'Focus on what you need to review each day: safety state, where data lives, and shortcuts to related work areas.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="so9-surface p-4">
                  <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Nguồn cờ hiệu lực' : 'Effective flag source'}</p>
                  <p className="mt-2 text-sm text-[#62728b]">{flagSourceLabel}</p>
                </div>
                <div className="so9-surface p-4">
                  <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Phiên bản ứng dụng' : 'App version'}</p>
                  <p className="mt-2 text-sm text-[#62728b]">{appVersion}</p>
                </div>
                <div className="so9-surface p-4">
                  <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Vị trí dữ liệu' : 'Data location'}</p>
                  <p className="mt-2 text-sm text-[#62728b]">
                    {language === 'vi' ? 'SQLite cục bộ trong môi trường app/project hiện tại.' : 'Local SQLite in the current app/project environment.'}
                  </p>
                </div>
                <div className="so9-surface p-4">
                  <p className="text-sm font-semibold text-[#17233b]">{language === 'vi' ? 'Quản lý tài khoản' : 'Account management'}</p>
                  <p className="mt-2 text-sm text-[#62728b]">
                    {language === 'vi'
                      ? 'Kết nối Facebook trong mục Accounts rồi chọn kênh rõ ràng cho từng lần lưu, lên lịch hoặc đăng. TikTok vẫn được giữ ngoài phạm vi an toàn hiện tại.'
                      : 'Connect Facebook in Accounts, then choose a channel explicitly for each save, schedule, or publish action. TikTok intentionally remains outside the current safe scope.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <button
                  type="button"
                  className="so9-surface flex items-start justify-between gap-3 p-4 text-left transition hover:border-[#c8d8ff] hover:bg-[#f8fbff]"
                  onClick={() => navigate('/accounts')}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#17233b]">
                      {language === 'vi' ? 'Tài khoản Facebook' : 'Facebook Accounts'}
                    </p>
                    <p className="mt-2 text-sm text-[#62728b]">
                      {language === 'vi'
                        ? 'Rà soát danh tính đã kết nối, token và mức sẵn sàng của tài khoản.'
                        : 'Review connected identities, token health, and account readiness.'}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6c7b92]" />
                </button>

                <button
                  type="button"
                  className="so9-surface flex items-start justify-between gap-3 p-4 text-left transition hover:border-[#c8d8ff] hover:bg-[#f8fbff]"
                  onClick={() => navigate('/connected-channels')}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#17233b]">
                      {language === 'vi' ? 'Kênh đang kết nối' : 'Connected Channels'}
                    </p>
                    <p className="mt-2 text-sm text-[#62728b]">
                      {language === 'vi'
                        ? 'Xem Trang đã lưu, avatar Trang, trạng thái readiness và các thao tác cục bộ an toàn.'
                        : 'View stored Pages, Page avatars, readiness states, and safe local actions.'}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6c7b92]" />
                </button>

                <button
                  type="button"
                  className="so9-surface flex items-start justify-between gap-3 p-4 text-left transition hover:border-[#c8d8ff] hover:bg-[#f8fbff]"
                  onClick={() => navigate('/diagnostics')}
                >
                  <div>
                    <p className="text-sm font-semibold text-[#17233b]">
                      {language === 'vi' ? 'Chẩn đoán & runtime' : 'Diagnostics & runtime'}
                    </p>
                    <p className="mt-2 text-sm text-[#62728b]">
                      {language === 'vi'
                        ? 'Mở chẩn đoán để xem queue, scheduler và trạng thái runtime an toàn.'
                        : 'Open Diagnostics to inspect queue, scheduler, and safe runtime state.'}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6c7b92]" />
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}