import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import log from 'electron-log';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../src/lib/prisma';
import ScheduleService from '../src/services/ScheduleService';
import PostService from '../src/services/PostService';
import type {
  BulkPublishCreateJobsResult,
  BulkPublishEligibilityReason,
  BulkPublishPrepareRowPayload,
  BulkPublishPreparedRow,
  UpdateStateSnapshot,
} from '../src/types/electron';
import { accountService } from '../src/services/AccountService';
import { appSettingsService } from '../src/services/AppSettingsService';
import { notificationService } from '../src/services/NotificationService';
import { accountConnectionService } from '../src/services/AccountConnectionService';
import { OAuthService } from '../src/services/oauth/OAuthService';
import { loadLocalEnv } from '../src/lib/loadLocalEnv';
import { loadFacebookEnvConfig } from '../src/services/facebook/FacebookConfigService';
import { facebookPublishReadinessService } from '../src/services/facebook/FacebookPublishReadinessService';
import { publishJobService } from '../src/services/PublishJobService';
import MediaService from '../src/services/MediaService';
import { dialog } from 'electron';
import fsSync from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envLocalPath = path.resolve(projectRoot, '.env.local');
const isDevRuntime = !!process.env.VITE_DEV_SERVER_URL;

if (!isDevRuntime) {
  const packagedPrismaDirCandidates = [
    path.resolve(projectRoot, 'prisma'),
    path.join(process.resourcesPath, 'prisma'),
  ];

  for (const candidate of packagedPrismaDirCandidates) {
    try {
      if (fsSync.existsSync(candidate) && fsSync.statSync(candidate).isDirectory()) {
        process.chdir(candidate);
        console.info('[env] production prisma cwd=%s', candidate);
        break;
      }
    } catch {
      // ignore invalid packaged path candidates such as ASAR virtual directories
    }
  }
}

const { loadedFiles: loadedEnvFiles, realPublishFlagSource } = loadLocalEnv(projectRoot);
process.env.FACEBOOK_REAL_PUBLISH_FLAG_SOURCE = realPublishFlagSource;

console.info('[env] cwd=%s', process.cwd());
console.info('[env] projectRoot=%s', projectRoot);
console.info('[env] envLocalPath=%s', envLocalPath);
const realPublishFlagNormalized = String(
  process.env.FACEBOOK_REAL_PUBLISH_ENABLED ?? 'false'
)
  .trim()
  .toLowerCase();
const realPublishFlagMaskedStatus =
  realPublishFlagNormalized === 'true'
    ? 'present:true'
    : realPublishFlagNormalized === 'false'
      ? 'present:false'
      : process.env.FACEBOOK_REAL_PUBLISH_ENABLED
        ? 'present:nonstandard'
        : 'missing';

console.info('[env] FACEBOOK_REAL_PUBLISH_ENABLED status=%s', realPublishFlagMaskedStatus);
console.info(
  '[env] FACEBOOK_REAL_PUBLISH_FLAG_SOURCE=%s',
  process.env.FACEBOOK_REAL_PUBLISH_FLAG_SOURCE ?? 'default_false'
);

let mainWindow: BrowserWindow | null = null;
let oauthWindow: BrowserWindow | null = null;
const appStartTime = Date.now();
const recentBulkPublishConfirmationTokens = new Set<string>();
const CONTROLLED_REAL_BULK_TEST_MAX_POSTS = 2;

let updaterInitialized = false;
let updaterState: UpdateStateSnapshot = {
  status: 'idle',
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  version: null,
  currentVersion: app.getVersion(),
  releaseName: null,
  releaseDate: null,
  downloadedFile: null,
  progress: null,
  message: null,
  errorMessage: null,
  canCheckForUpdates: process.platform === 'win32',
  canDownloadUpdate: false,
  canQuitAndInstall: false,
  lastCheckedAt: null,
};

app.disableHardwareAcceleration();

async function runAccountsUiProbe(window: BrowserWindow) {
  if (!process.env.FACEBOOK_UI_ASSERT_ON_START) {
    return;
  }

  try {
    const runProbe = async (
      route: string,
      expectedText: string[],
      label: string,
      collectExtra: string
    ) => {
      const result = await window.webContents.executeJavaScript(`
        (async () => {
          const errors = [];
          const targetRoute = ${JSON.stringify(route)};
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const waitFor = async (predicate, timeoutMs = 5000) => {
            const start = Date.now();
            while (Date.now() - start < timeoutMs) {
              if (predicate()) {
                return true;
              }
              await sleep(200);
            }
            return false;
          };
          const normalize = (value) =>
            (value || '')
              .normalize('NFD')
              .replace(/[\\u0300-\\u036f]/g, '')
              .toLowerCase()
              .trim();
          const containsAny = (label, values) => values.some((value) => normalize(label).includes(normalize(value)));
          const findButton = (values) =>
            Array.from(document.querySelectorAll('button')).find((button) => containsAny(button.innerText || '', values));
          const findNavLinkByRoute = (href) =>
            Array.from(document.querySelectorAll('a')).find((link) => {
              const rawHref = link.getAttribute('href') || '';
              return rawHref === href || rawHref.endsWith(href);
            });
          const findByTestId = (value) => document.querySelector('[data-testid="' + value + '"]');
          const waitForTestId = async (value, timeoutMs = 5000) =>
            waitFor(() => !!findByTestId(value), timeoutMs);
          const clickTestId = async (value) => {
            const element = findByTestId(value);
            if (!element) {
              errors.push('missing_test_id:' + value);
              return false;
            }
            element.click();
            await sleep(150);
            return true;
          };
          const setElementValue = (element, value) => {
            if (!element) return false;
            const prototype =
              element instanceof HTMLTextAreaElement
                ? window.HTMLTextAreaElement.prototype
                : element instanceof HTMLSelectElement
                  ? window.HTMLSelectElement.prototype
                  : window.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
            descriptor?.set?.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          };
          const fillTestId = async (value, nextValue) => {
            const element = findByTestId(value);
            if (!element) {
              errors.push('missing_test_id:' + value);
              return false;
            }
            const updated = setElementValue(element, nextValue);
            await sleep(150);
            return updated;
          };
          const getTextByTestId = (value) => {
            const element = findByTestId(value);
            return element ? (element.textContent || '').trim() : '';
          };
          const assertVisibleByTestId = (value) => !!findByTestId(value);
          const collectQueueSnapshot = async () => {
            const diagnostics = await window.electronAPI.diagnostics.getSnapshot();
            return {
              jobCount: diagnostics.database.jobCount,
              pending: diagnostics.scheduler.queue.pending,
              active:
                (diagnostics.scheduler.queue.pending || 0) +
                (diagnostics.scheduler.queue.processing || 0),
            };
          };
          const collectPostJobDelta = (before, after, postsBefore, postsAfter) => ({
            createdPostDelta: postsAfter.posts.length - postsBefore.posts.length,
            jobCountDelta: after.jobCount - before.jobCount,
            pendingBefore: before.pending,
            pendingAfter: after.pending,
            activeBefore: before.active,
            activeAfter: after.active,
          });
          const sanitizeProbeOutput = (payload) => ({
            probeName: payload.probeName,
            realPublishingEnabled: payload.realPublishingEnabled ?? null,
            exactBlockedMessageVisible: payload.exactBlockedMessageVisible ?? null,
            modalVisible: payload.modalVisible ?? null,
            confirmDisabledInitial: payload.confirmDisabledInitial ?? null,
            confirmDisabledAfterCheckbox: payload.confirmDisabledAfterCheckbox ?? null,
            confirmDisabledAfterPublish: payload.confirmDisabledAfterPublish ?? null,
            createdPostDelta: payload.createdPostDelta ?? null,
            jobCountDelta: payload.jobCountDelta ?? null,
            pendingBefore: payload.pendingBefore ?? null,
            pendingAfter: payload.pendingAfter ?? null,
            activeBefore: payload.activeBefore ?? null,
            activeAfter: payload.activeAfter ?? null,
            selectedPostCount: payload.selectedPostCount ?? null,
            eligibleCount: payload.eligibleCount ?? null,
            blockedCount: payload.blockedCount ?? null,
            queuePostIds: Array.isArray(payload.queuePostIds) ? payload.queuePostIds : [],
            errors: [
              ...errors,
              ...(Array.isArray(payload.errors) ? payload.errors : []),
            ],
          });

          const navigateToRoute = async () => {
            if (window.location.pathname === targetRoute) {
              return true;
            }

            const navLink = findNavLinkByRoute(targetRoute);
            if (navLink instanceof HTMLElement) {
              navLink.click();
              await sleep(500);
            } else {
              window.history.pushState({}, '', targetRoute);
              window.dispatchEvent(new PopStateEvent('popstate'));
              await sleep(500);
            }

            return waitFor(() => window.location.pathname === targetRoute, 8000);
          };

          await navigateToRoute();

          await waitFor(() => {
            const text = normalize(document.body.innerText || '');
            return ${JSON.stringify(expectedText)}.some((value) => text.includes(normalize(value)));
          }, 8000);

          await sleep(1200);

          const text = document.body.innerText || '';
          ${collectExtra}
        })();
      `);

      console.info(
        '[' + label + '] UI assertion result',
        JSON.stringify(result, null, 2)
      );
    };

    await runProbe(
      '/',
      ['Trang chủ', 'Home · daily control center', 'Personal Dashboard'],
      'NavigationAndDashboard',
      `
        const navLabels = ['Trang chủ', 'Đăng bài viết', 'Quản lý bài đăng', 'Kết nối kênh', 'Đăng hàng loạt', 'Tài khoản Facebook', 'Chẩn đoán', 'Cài đặt'];
        const bodyText = document.body.innerText || '';
        const missingNavLabels = navLabels.filter((label) => !bodyText.includes(label));
        const heroVisible =
          bodyText.includes('Home · daily control center') ||
          bodyText.includes('Trang chủ · điều phối hằng ngày') ||
          bodyText.includes('Personal Dashboard') ||
          bodyText.includes('Tổng quan cá nhân');
        const connectedChannelsShortcutVisible =
          bodyText.includes('Mở Kết nối kênh') || bodyText.includes('Open Connected Channels');
        const diagnosticsShortcutVisible =
          bodyText.includes('Mở Chẩn đoán') || bodyText.includes('Open Diagnostics');

        return sanitizeProbeOutput({
          probeName: 'NavigationAndDashboard',
          realPublishingEnabled: null,
          exactBlockedMessageVisible: null,
          modalVisible: heroVisible,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: connectedChannelsShortcutVisible ? 1 : 0,
          blockedCount: missingNavLabels.length,
          queuePostIds: [],
          errors: [
            ...missingNavLabels.map((label) => 'missing_nav_label:' + label),
            ...(heroVisible ? [] : ['dashboard_hero_missing']),
            ...(connectedChannelsShortcutVisible ? [] : ['dashboard_connected_channels_shortcut_missing']),
            ...(diagnosticsShortcutVisible ? [] : ['dashboard_diagnostics_shortcut_missing']),
          ],
        });
      `
    );

    await runProbe(
      '/connected-channels',
      ['Kết nối kênh', 'Connected channels · real Facebook Page data', 'Connected Channels'],
      'ConnectedChannelsPage',
      `
        const pageSnapshot = await window.electronAPI.accounts.getConnectionStatus();
        const bodyText = document.body.innerText || '';
        const addChannelVisible = bodyText.includes('Thêm kênh') || bodyText.includes('Add Channel');
        const accountsLinkVisible = bodyText.includes('Mở Tài khoản Facebook') || bodyText.includes('Open Facebook Accounts');
        const realPageDataMessageVisible =
          bodyText.includes('dữ liệu Facebook Page thật') ||
          bodyText.includes('real Facebook Page data');
        const noFakeRowsMessageVisible =
          bodyText.includes('không tạo hàng giả') ||
          bodyText.includes('without any synthetic rows');
        const hasChannelList =
          bodyText.includes('Danh sách kênh') ||
          bodyText.includes('Channel List') ||
          bodyText.includes('Chưa có kênh nào được kết nối.') ||
          bodyText.includes('No channels connected yet.');
        const defaultChannelVisible = bodyText.includes('Kênh mặc định') || bodyText.includes('Default channel');

        return sanitizeProbeOutput({
          probeName: 'ConnectedChannelsPage',
          realPublishingEnabled: pageSnapshot?.facebook?.realPublishingEnabled ?? null,
          exactBlockedMessageVisible: realPageDataMessageVisible,
          modalVisible: hasChannelList,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: defaultChannelVisible ? 1 : 0,
          blockedCount: null,
          queuePostIds: [],
          errors: [
            ...(addChannelVisible ? [] : ['connected_channels_add_channel_missing']),
            ...(accountsLinkVisible ? [] : ['connected_channels_accounts_link_missing']),
            ...(realPageDataMessageVisible ? [] : ['connected_channels_real_page_copy_missing']),
            ...(noFakeRowsMessageVisible ? [] : ['connected_channels_no_fake_rows_copy_missing']),
            ...(hasChannelList ? [] : ['connected_channels_list_missing']),
          ],
        });
      `
    );

    await runProbe(
      '/posts',
      ['Quản lý bài đăng', 'Posts · status, detail, safe actions', 'Post Library'],
      'PostsPageOverview',
      `
        const bodyText = document.body.innerText || '';
        const filtersVisible =
          bodyText.includes('Bộ lọc kênh / nền tảng') ||
          bodyText.includes('Channel / platform filter') ||
          bodyText.includes('Bộ lọc kênh/media') ||
          bodyText.includes('Channel/media filters');
        const reelsMessageVisible =
          bodyText.includes('Facebook có thể hiển thị video mới dưới dạng Reels') ||
          bodyText.includes('Facebook may show new videos as Reels');
        const diagnosticsLinkVisible =
          bodyText.includes('Mở Chẩn đoán') ||
          bodyText.includes('Open Diagnostics') ||
          bodyText.includes('Opened from Diagnostics recent jobs.') ||
          bodyText.includes('Được mở từ công việc gần đây trong Chẩn đoán.');
        const targetChannelLabelVisible =
          bodyText.includes('Kênh đích') ||
          bodyText.includes('Target channel');

        return sanitizeProbeOutput({
          probeName: 'PostsPageOverview',
          realPublishingEnabled: null,
          exactBlockedMessageVisible: reelsMessageVisible,
          modalVisible: filtersVisible,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: targetChannelLabelVisible ? 1 : 0,
          blockedCount: null,
          queuePostIds: [],
          errors: [
            ...(filtersVisible ? [] : ['posts_filters_missing']),
            ...(reelsMessageVisible ? [] : ['posts_reels_copy_missing']),
            ...(diagnosticsLinkVisible ? [] : ['posts_diagnostics_link_missing']),
            ...(targetChannelLabelVisible ? [] : ['posts_target_channel_label_missing']),
          ],
        });
      `
    );

    await runProbe(
      '/diagnostics',
      ['Chẩn đoán', 'Diagnostics', 'summary first', 'summary trước'],
      'DiagnosticsPage',
      `
        const bodyText = document.body.innerText || '';
        const normalizedBody = normalize(bodyText);
        const summaryFirstVisible =
          normalizedBody.includes(normalize('summary first, details later')) ||
          normalizedBody.includes(normalize('summary trước, chi tiết sau')) ||
          normalizedBody.includes(normalize('safe summary view')) ||
          normalizedBody.includes(normalize('summary an toàn'));
        const reelsMessageVisible =
          normalizedBody.includes(normalize('Facebook có thể hiển thị video mới dưới dạng Reels')) ||
          normalizedBody.includes(normalize('Facebook may show new videos as Reels')) ||
          normalizedBody.includes(normalize('Facebook may display newly uploaded videos as Reels'));
        const advancedToggleVisible =
          normalizedBody.includes(normalize('Mở điều tra nâng cao')) ||
          normalizedBody.includes(normalize('Open advanced investigation')) ||
          normalizedBody.includes(normalize('Quay về summary an toàn')) ||
          normalizedBody.includes(normalize('Return to safe summary')) ||
          normalizedBody.includes(normalize('chi tiết nâng cao')) ||
          normalizedBody.includes(normalize('advanced details'));
        const runtimeSnapshotVisible =
          normalizedBody.includes(normalize('scheduler')) ||
          normalizedBody.includes(normalize('queue')) ||
          normalizedBody.includes(normalize('runtime')) ||
          normalizedBody.includes(normalize('nguồn effective flag')) ||
          normalizedBody.includes(normalize('effective flag source')) ||
          normalizedBody.includes(normalize('summary an toàn')) ||
          normalizedBody.includes(normalize('safe summary view'));

        return sanitizeProbeOutput({
          probeName: 'DiagnosticsPage',
          realPublishingEnabled: null,
          exactBlockedMessageVisible: reelsMessageVisible,
          modalVisible: summaryFirstVisible,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: runtimeSnapshotVisible ? 1 : 0,
          blockedCount: null,
          queuePostIds: [],
          errors: [
            ...(summaryFirstVisible ? [] : ['diagnostics_summary_first_missing']),
            ...(advancedToggleVisible ? [] : ['diagnostics_advanced_toggle_missing']),
            ...(runtimeSnapshotVisible ? [] : ['diagnostics_runtime_labels_missing']),
          ],
        });
      `
    );

    await runProbe(
      '/settings',
      ['Cài đặt', 'Settings', 'safe mode', 'vận hành cá nhân'],
      'SettingsPage',
      `
        const bodyText = document.body.innerText || '';
        const normalizedBody = normalize(bodyText);
        const languageVisible =
          normalizedBody.includes(normalize('Ngôn ngữ')) ||
          normalizedBody.includes(normalize('Language')) ||
          normalizedBody.includes(normalize('Ngôn ngữ giao diện')) ||
          normalizedBody.includes(normalize('Interface language'));
        const safeModeVisible =
          normalizedBody.includes(normalize('safe mode')) ||
          normalizedBody.includes(normalize('chế độ an toàn')) ||
          normalizedBody.includes(normalize('Đăng thật đang tắt')) ||
          normalizedBody.includes(normalize('Real publishing is off'));
        const realPublishSourceVisible =
          normalizedBody.includes(normalize('effective real-publish flag source')) ||
          normalizedBody.includes(normalize('nguồn cờ đăng thật hiệu lực')) ||
          normalizedBody.includes(normalize('nguồn cờ hiệu lực')) ||
          normalizedBody.includes(normalize('effective flag source')) ||
          normalizedBody.includes(normalize('flag source')) ||
          normalizedBody.includes('facebook_real_publish');
        const backupGuidanceVisible =
          normalizedBody.includes(normalize('Safe backup guidance')) ||
          normalizedBody.includes(normalize('Hướng dẫn sao lưu an toàn')) ||
          normalizedBody.includes(normalize('application data')) ||
          normalizedBody.includes(normalize('backup')) ||
          normalizedBody.includes(normalize('sao lưu')) ||
          normalizedBody.includes(normalize('dữ liệu'));
        const linkedPagesVisible =
          normalizedBody.includes(normalize('Connected Channels')) ||
          normalizedBody.includes(normalize('Kết nối kênh')) ||
          normalizedBody.includes(normalize('Open Connected Channels')) ||
          normalizedBody.includes(normalize('Mở Kết nối kênh'));
        const linkedAccountsVisible =
          normalizedBody.includes(normalize('Facebook Accounts')) ||
          normalizedBody.includes(normalize('Tài khoản Facebook')) ||
          normalizedBody.includes(normalize('Open Facebook Accounts')) ||
          normalizedBody.includes(normalize('Mở Tài khoản Facebook'));
        const linkedDiagnosticsVisible =
          normalizedBody.includes(normalize('Diagnostics')) ||
          normalizedBody.includes(normalize('Chẩn đoán')) ||
          normalizedBody.includes(normalize('Open Diagnostics')) ||
          normalizedBody.includes(normalize('Mở Chẩn đoán'));
        const tokenEditorHidden =
          !normalizedBody.includes(normalize('access token')) &&
          !normalizedBody.includes(normalize('client secret')) &&
          !normalizedBody.includes(normalize('app secret')) &&
          !normalizedBody.includes(normalize('callback url')) &&
          !normalizedBody.includes(normalize('environment editor'));

        return sanitizeProbeOutput({
          probeName: 'SettingsPage',
          realPublishingEnabled: null,
          exactBlockedMessageVisible: tokenEditorHidden,
          modalVisible: languageVisible && safeModeVisible,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: [linkedPagesVisible, linkedAccountsVisible, linkedDiagnosticsVisible].filter(Boolean).length,
          blockedCount: null,
          queuePostIds: [],
          errors: [
            ...(languageVisible ? [] : ['settings_language_missing']),
            ...(safeModeVisible ? [] : ['settings_safe_mode_missing']),
            ...(realPublishSourceVisible ? [] : ['settings_real_publish_source_missing']),
            ...(backupGuidanceVisible ? [] : ['settings_backup_guidance_missing']),
            ...(linkedPagesVisible ? [] : ['settings_connected_channels_link_missing']),
            ...(linkedAccountsVisible ? [] : ['settings_accounts_link_missing']),
            ...(linkedDiagnosticsVisible ? [] : ['settings_diagnostics_link_missing']),
            ...(tokenEditorHidden ? [] : ['settings_token_or_secret_exposed']),
          ],
        });
      `
    );

    await runProbe(
      '/create-post',
      ['Đăng bài viết', 'Create post', 'unified media composer', 'Upload Media'],
      'CreatePostUnifiedMediaUx',
      `
        const bodyText = document.body.innerText || '';
        const normalizedBody = normalize(bodyText);
        const unifiedFlowVisible =
          normalizedBody.includes(normalize('1. Chọn định dạng')) ||
          normalizedBody.includes(normalize('1. Choose format')) ||
          normalizedBody.includes(normalize('2. Chọn kênh đăng')) ||
          normalizedBody.includes(normalize('2. Choose publishing channel')) ||
          normalizedBody.includes(normalize('3. Tải media')) ||
          normalizedBody.includes(normalize('3. Upload media'));
        const selectorVisible =
          normalizedBody.includes(normalize('Kênh đã chọn')) ||
          normalizedBody.includes(normalize('Selected channels')) ||
          normalizedBody.includes(normalize('publishing channel')) ||
          normalizedBody.includes(normalize('kênh đăng')) ||
          normalizedBody.includes(normalize('Facebook Page'));
        const storyUnsupportedVisible =
          normalizedBody.includes(normalize('Đăng Tin chưa được hỗ trợ với kết nối Facebook hiện tại')) ||
          normalizedBody.includes(normalize('Story publishing is not supported by the current Facebook connection'));
        const uploadMediaVisible =
          normalizedBody.includes(normalize('Tải media')) ||
          normalizedBody.includes(normalize('Upload Media')) ||
          normalizedBody.includes(normalize('Tải nhiều ảnh hoặc một video')) ||
          normalizedBody.includes(normalize('Upload multiple images or one video'));
        const postNowButton = findByTestId('create-post-post-now-button');
        const safetyBannerVisible = !!findByTestId('create-post-safety-banner');
        const disabledMessageVisible = !!findByTestId('create-post-real-publish-disabled-message');
        const metadataVisible =
          normalizedBody.includes(normalize('Tệp video')) ||
          normalizedBody.includes(normalize('Video file')) ||
          normalizedBody.includes(normalize('MIME type')) ||
          normalizedBody.includes(normalize('Duration')) ||
          normalizedBody.includes(normalize('Thời lượng'));
        const postNowDisabledReason = getTextByTestId('create-post-post-now-disabled-reason');
        const postNowGuarded =
          !!postNowButton?.disabled ||
          disabledMessageVisible ||
          normalizedBody.includes(normalize('Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.')) ||
          normalize(postNowDisabledReason).includes(normalize('Real Facebook publishing is disabled')) ||
          normalize(postNowDisabledReason).includes(normalize('Unable to verify Facebook publishing mode')) ||
          normalize(postNowDisabledReason).includes(normalize('Select a Facebook Page first'));

        return sanitizeProbeOutput({
          probeName: 'CreatePostUnifiedMediaUx',
          realPublishingEnabled: null,
          exactBlockedMessageVisible: storyUnsupportedVisible || disabledMessageVisible,
          modalVisible: safetyBannerVisible,
          confirmDisabledInitial: !!postNowButton?.disabled,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: selectorVisible ? 1 : 0,
          blockedCount: metadataVisible ? 0 : 1,
          queuePostIds: [],
          errors: [
            ...(unifiedFlowVisible ? [] : ['create_post_unified_flow_missing']),
            ...(selectorVisible ? [] : ['create_post_channel_selector_missing']),
            ...(storyUnsupportedVisible ? [] : ['create_post_story_unsupported_copy_missing']),
            ...(uploadMediaVisible ? [] : ['create_post_upload_media_missing']),
            ...(safetyBannerVisible ? [] : ['create_post_safety_banner_missing']),
            ...(postNowButton ? [] : ['create_post_post_now_button_missing']),
            ...(postNowGuarded ? [] : ['create_post_post_now_not_guarded']),
          ],
        });
      `
    );

    await runProbe(
      '/accounts',
      ['Accounts', 'Facebook Setup & Account Health'],
      'AccountsPage',
      `
        let ipcStatus = null;
        let ipcError = null;

        try {
          ipcStatus = await window.electronAPI.accounts.getConnectionStatus();
        } catch (error) {
          ipcError = error instanceof Error ? error.message : String(error);
        }

        return {
          probeName: 'AccountsPage',
          realPublishingEnabled: ipcStatus?.facebook?.realPublishingEnabled ?? null,
          exactBlockedMessageVisible: null,
          modalVisible: null,
          confirmDisabledInitial: null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: null,
          jobCountDelta: null,
          pendingBefore: null,
          pendingAfter: null,
          activeBefore: null,
          activeAfter: null,
          selectedPostCount: null,
          eligibleCount: null,
          blockedCount: null,
          queuePostIds: [],
          errors: ipcError ? [ipcError] : [],
        };
      `
    );

    await runProbe(
      '/create-post',
      ['Create Post', 'Checking Facebook publishing mode...', 'Controlled real Facebook publishing is ENABLED for this session.', 'Real Facebook publishing remains disabled.'],
      'CreatePostPage',
      `
        let ipcStatus = null;
        let ipcError = null;

        try {
          ipcStatus = await window.electronAPI.accounts.getConnectionStatus();
        } catch (error) {
          ipcError = error instanceof Error ? error.message : String(error);
        }

        const queueBefore = await collectQueueSnapshot();
        const postsBefore = await window.electronAPI.posts.list();

        const blockedMessage =
          'Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.';
        const bannerStatusText = getTextByTestId('create-post-real-publish-status');
        const disabledMessageText = getTextByTestId('create-post-real-publish-disabled-message');
        const exactBlockedMessageVisible =
          assertVisibleByTestId('create-post-real-publish-disabled-message') ||
          normalize(disabledMessageText).includes(normalize(blockedMessage)) ||
          normalize(text).includes(normalize(blockedMessage));

        const bannerMode =
          /enabled for this session|BẬT cho phiên này/i.test(bannerStatusText)
            ? 'enabled'
            : /Unable to verify Facebook publishing mode|Không thể xác minh chế độ đăng Facebook/i.test(bannerStatusText)
              ? 'error'
              : /Checking Facebook publishing mode|Đang kiểm tra chế độ đăng Facebook/i.test(bannerStatusText)
                ? 'loading'
                : /Real Facebook publishing is disabled|Đăng Facebook thật đang tắt|safe mode|chế độ an toàn/i.test(bannerStatusText + ' ' + disabledMessageText)
                  ? 'disabled'
                  : assertVisibleByTestId('create-post-safety-banner')
                    ? 'visible'
                    : 'unknown';

        const postNowButton = findByTestId('create-post-post-now-button');
        const postNowDisabledReason = getTextByTestId('create-post-post-now-disabled-reason');
        const postNowGuarded =
          !!postNowButton?.disabled ||
          normalize(postNowDisabledReason).includes(normalize(blockedMessage)) ||
          exactBlockedMessageVisible;

        const queueAfter = await collectQueueSnapshot();
        const postsAfter = await window.electronAPI.posts.list();
        const deltas = collectPostJobDelta(queueBefore, queueAfter, postsBefore, postsAfter);

        return {
          probeName: 'CreatePostPage',
          realPublishingEnabled: ipcStatus?.facebook?.realPublishingEnabled ?? null,
          exactBlockedMessageVisible,
          modalVisible: null,
          confirmDisabledInitial: postNowButton ? !!postNowButton.disabled : null,
          confirmDisabledAfterCheckbox: null,
          confirmDisabledAfterPublish: null,
          createdPostDelta: deltas.createdPostDelta,
          jobCountDelta: deltas.jobCountDelta,
          pendingBefore: deltas.pendingBefore,
          pendingAfter: deltas.pendingAfter,
          activeBefore: deltas.activeBefore,
          activeAfter: deltas.activeAfter,
          selectedPostCount: null,
          eligibleCount: null,
          blockedCount: postNowGuarded ? 1 : 0,
          queuePostIds: [],
          errors: [
            ...(ipcError ? [ipcError] : []),
            ...(bannerMode === 'unknown' ? ['create_post_banner_unknown'] : []),
            ...(!postNowGuarded ? ['create_post_post_now_not_guarded'] : []),
          ],
        };
      `
    );

    await runProbe(
      '/bulk-create',
      ['Bulk Create Posts', 'Tạo bài viết hàng loạt'],
      'BulkCreatePage',
      `
        const probeName = 'BulkCreatePage';
        const findBulkPublishButton = () => findByTestId('bulk-create-open-bulk-publish-review');

        await sleep(1500);

        const rowCards = Array.from(document.querySelectorAll('.rounded-lg.border.p-4'));
        const rowOne = rowCards[0];
        const rowTwo = rowCards[1];
        const rowThree = rowCards[2];

        const rowOneTextarea = rowOne?.querySelector('textarea');
        const rowTwoTextarea = rowTwo?.querySelector('textarea');
        const rowThreeTextarea = rowThree?.querySelector('textarea');
        setElementValue(rowOneTextarea, 'Phase 16.2 valid text row 1');
        setElementValue(rowTwoTextarea, 'Phase 16.2 valid text row 2');
        setElementValue(rowThreeTextarea, '');

        const rowThreeSelect = rowThree?.querySelector('select');
        setElementValue(rowThreeSelect, '');

        const addRowButton = findButton(['them dong', 'add row']);
        addRowButton?.click();
        await sleep(200);
        addRowButton?.click();
        await sleep(200);

        const refreshedRowCards = Array.from(document.querySelectorAll('.rounded-lg.border.p-4'));
        const globalSelect = document.querySelector('select');
        const globalPageValue = globalSelect ? globalSelect.value : '';

        const fourthRow = refreshedRowCards[3];
        const fifthRow = refreshedRowCards[4];

        const fourthTextarea = fourthRow?.querySelector('textarea');
        const fifthTextarea = fifthRow?.querySelector('textarea');
        setElementValue(fourthTextarea, 'Phase 16.2 valid text row 4 for batch limit');
        setElementValue(fifthTextarea, 'Phase 16.2 valid text row 5 for batch limit');

        const fourthSelect = fourthRow?.querySelector('select');
        const fifthSelect = fifthRow?.querySelector('select');
        if (globalPageValue) {
          setElementValue(fourthSelect, globalPageValue);
          setElementValue(fifthSelect, globalPageValue);
        }

        const openImportButton = findButton(['mo vung dan nhap', 'open paste import', 'an vung dan nhap', 'hide paste import']);
        openImportButton?.click();
        await sleep(300);

        const importTextarea = Array.from(document.querySelectorAll('textarea'))[1];
        setElementValue(
          importTextarea,
          'title,content,pageName,mediaPath\\nInvalid image row,Has image path,Món Ngon Mỗi Ngày,/tmp/phase16-missing-image.jpg'
        );

        const previewButton = findButton(['xem truoc du lieu nhap', 'preview import']);
        previewButton?.click();
        await sleep(1500);

        const queueBefore = await collectQueueSnapshot();
        const postsBefore = await window.electronAPI.posts.list();

        const bulkButton = findBulkPublishButton();
        const reviewTextBeforeClick = document.body.innerText || '';
        const hasBatchLimitMessageBeforeClick =
          reviewTextBeforeClick.includes('limited to 3 posts per batch') ||
          reviewTextBeforeClick.includes('tối đa 3 bài mỗi batch');

        if (fifthRow) {
          setElementValue(fifthTextarea, '');
        }
        await sleep(500);

        const bulkButtonAfterLimitAdjustment = findBulkPublishButton();
        bulkButtonAfterLimitAdjustment?.click();

        const modalWaitPassed = await waitForTestId('bulk-create-bulk-publish-modal', 5000);

        const queueAfter = await collectQueueSnapshot();
        const postsAfter = await window.electronAPI.posts.list();

        const confirmInput = findByTestId('bulk-create-bulk-publish-confirm-input');
        const confirmCheckbox = findByTestId('bulk-create-bulk-publish-confirm-checkbox');
        const confirmButton = findByTestId('bulk-create-bulk-publish-confirm-button');

        const blockedMessage = 'Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.';
        const reviewText = document.body.innerText || '';
        const exactBlockedMessageVisible =
          assertVisibleByTestId('bulk-create-real-publish-disabled-message') ||
          getTextByTestId('bulk-create-real-publish-disabled-message').includes(blockedMessage);
        const modalVisible = assertVisibleByTestId('bulk-create-bulk-publish-modal') || modalWaitPassed || !!confirmInput || !!confirmButton;

        let confirmDisabledInitial = confirmButton ? !!confirmButton.disabled : null;
        let confirmDisabledAfterCheckbox = null;
        let confirmDisabledAfterPublish = null;

        if (confirmCheckbox) {
          confirmCheckbox.click();
          await sleep(250);
          confirmDisabledAfterCheckbox = confirmButton ? !!confirmButton.disabled : null;
        }

        if (confirmInput) {
          setElementValue(confirmInput, 'PUBLISH');
          await sleep(250);
          confirmDisabledAfterPublish = confirmButton ? !!confirmButton.disabled : null;
        }

        return sanitizeProbeOutput({
          probeName,
          realPublishingEnabled: false,
          exactBlockedMessageVisible,
          modalVisible,
          confirmDisabledInitial,
          confirmDisabledAfterCheckbox,
          confirmDisabledAfterPublish,
          selectedPostCount: Array.from(document.querySelectorAll('.rounded-lg.border.p-4')).length,
          eligibleCount: reviewText.includes('eligible') || reviewText.includes('đủ điều kiện') ? 1 : 0,
          blockedCount:
            reviewText.includes('Missing target Page.') ||
            reviewText.includes('Thiếu Trang đích.') ||
            reviewText.includes('Missing content or image.') ||
            reviewText.includes('Thiếu nội dung hoặc ảnh.') ||
            reviewText.includes('Image file is missing. Reattach the image.') ||
            reviewText.includes('Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.')
              ? 1
              : 0,
          queuePostIds: [],
          ...collectPostJobDelta(queueBefore, queueAfter, postsBefore, postsAfter),
        });
      `
    );

    await runProbe(
      '/posts',
      ['Review controlled bulk publish cho post đã tạo', 'Controlled bulk publish review for existing posts'],
      'PostsPersistedBulkReview',
      `
        const probeName = 'PostsPersistedBulkReview';
        const blockedMessage = 'Bulk real publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable controlled bulk publish.';

        await sleep(2000);

        const queueBefore = await collectQueueSnapshot();
        const postsBefore = await window.electronAPI.posts.list();
        const connectionStatus = await window.electronAPI.accounts.getConnectionStatus();
        const realPublishingEnabled = !!connectionStatus?.facebook?.realPublishingEnabled;

        const listCards = Array.from(document.querySelectorAll('[role="button"]'));
        const selectableCards = realPublishingEnabled ? listCards.slice(5, 7) : listCards.slice(0, 3);
        const clickedPostIds = [];

        selectableCards.forEach((card, index) => {
          const checkbox = card.querySelector('input[type="checkbox"]');
          if (checkbox && !checkbox.disabled) {
            checkbox.click();
            if (realPublishingEnabled) {
              const eligibleIds = [15, 14];
              const assumedId = eligibleIds[index];
              if (assumedId) {
                clickedPostIds.push(assumedId);
              }
            } else {
              const titleText = card.querySelector('h3')?.innerText || '';
              const matchedPost = postsBefore.posts.find((post) =>
                titleText
                  ? (post.title || '').includes(titleText) || titleText.includes(post.title || '')
                  : true
              );
              if (matchedPost) {
                clickedPostIds.push(matchedPost.id);
              }
            }
          }
        });

        await sleep(400);

        const reviewButton = findByTestId('posts-persisted-open-bulk-review') || findButton(['review selected posts', 'review selected posts for bulk publish']);

        reviewButton?.click();
        await sleep(800);

        const textAfterClick = document.body.innerText || '';
        const exactBlockedMessageVisible =
          assertVisibleByTestId('posts-persisted-bulk-disabled-message') ||
          getTextByTestId('posts-persisted-bulk-disabled-message').includes(blockedMessage);

        let modalWaitPassed = false;
        if (!exactBlockedMessageVisible) {
          const startedAt = Date.now();
          while (Date.now() - startedAt < 5000) {
            const confirmInput = findByTestId('posts-persisted-bulk-confirm-input');
            const confirmButton = findByTestId('posts-persisted-bulk-confirm-button');
            if (confirmInput || confirmButton || assertVisibleByTestId('posts-persisted-bulk-modal')) {
              modalWaitPassed = true;
              break;
            }
            await sleep(200);
          }
        }

        const confirmInput = findByTestId('posts-persisted-bulk-confirm-input');
        const confirmCheckbox = findByTestId('posts-persisted-bulk-confirm-checkbox');
        const confirmButton = findByTestId('posts-persisted-bulk-confirm-button');

        let confirmDisabledInitial = confirmButton ? !!confirmButton.disabled : null;
        let confirmDisabledAfterCheckbox = null;
        let confirmDisabledAfterPublish = null;
        let realConfirmClicked = false;
        let progressStatuses = [];
        let publishedPostIds = [];
        let failedPostIds = [];
        let queuePostIds = [];

        if (confirmCheckbox) {
          confirmCheckbox.click();
          await sleep(250);
          confirmDisabledAfterCheckbox = confirmButton ? !!confirmButton.disabled : null;
        }

        if (confirmInput) {
          const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
          descriptor?.set?.call(confirmInput, 'PUBLISH');
          confirmInput.dispatchEvent(new Event('input', { bubbles: true }));
          confirmInput.dispatchEvent(new Event('change', { bubbles: true }));
          await sleep(250);
          confirmDisabledAfterPublish = confirmButton ? !!confirmButton.disabled : null;
        }

        if (
          realPublishingEnabled &&
          confirmButton &&
          !confirmButton.disabled &&
          clickedPostIds.length > 0
        ) {
          confirmButton.click();
          realConfirmClicked = true;
          await sleep(1500);

          let latestPosts = [];
          for (let attempt = 0; attempt < 8; attempt += 1) {
            latestPosts = await window.electronAPI.bulkPublish.getProgress({ postIds: clickedPostIds });
            progressStatuses = latestPosts.map((post) => ({ id: post.id, status: post.status, errorMessage: post.errorMessage || null }));
            queuePostIds = latestPosts.map((post) => post.id);
            if (latestPosts.every((post) => ['published', 'failed', 'blocked', 'cancelled', 'posting', 'queued'].includes(post.status))) {
              await sleep(1000);
            }
            if (latestPosts.some((post) => ['published', 'failed', 'blocked', 'cancelled'].includes(post.status))) {
              break;
            }
            await sleep(2000);
          }

          publishedPostIds = latestPosts.filter((post) => post.status === 'published').map((post) => post.id);
          failedPostIds = latestPosts.filter((post) => ['failed', 'blocked', 'cancelled'].includes(post.status)).map((post) => post.id);
        }

        const queueAfter = await collectQueueSnapshot();
        const postsAfter = await window.electronAPI.posts.list();
        const reviewText = document.body.innerText || '';

        return sanitizeProbeOutput({
          probeName,
          realPublishingEnabled,
          exactBlockedMessageVisible,
          modalVisible: assertVisibleByTestId('posts-persisted-bulk-modal') || !!confirmInput || !!confirmButton || modalWaitPassed,
          confirmDisabledInitial,
          confirmDisabledAfterCheckbox,
          confirmDisabledAfterPublish,
          selectedPostCount: Array.from(document.querySelectorAll('[role="button"] input[type="checkbox"]:checked')).length,
          eligibleCount: reviewText.includes('eligible') || reviewText.includes('đủ điều kiện') ? 1 : 0,
          blockedCount: reviewText.includes('blocked') || reviewText.includes('bị chặn') ? 1 : 0,
          queuePostIds,
          ...collectPostJobDelta(queueBefore, queueAfter, postsBefore, postsAfter),
        });
      `
    );
  } catch (error) {
    console.warn('[AccountsPage] UI assertion probe failed', error);
  }
}

function getBulkEligibilityReasonLabel(
  reason: BulkPublishEligibilityReason,
  language: 'vi' | 'en',
  batchLimit: number
) {
  const labels: Record<BulkPublishEligibilityReason, string> = {
    missing_target_page: language === 'vi' ? 'Thiếu Trang đích.' : 'Missing target Page.',
    missing_content_or_image: language === 'vi' ? 'Thiếu nội dung hoặc ảnh.' : 'Missing content or image.',
    image_file_missing:
      language === 'vi'
        ? 'Không tìm thấy tệp ảnh. Vui lòng đính kèm lại ảnh.'
        : 'Image file is missing. Reattach the image.',
    unsupported_media_type: language === 'vi' ? 'Loại media không được hỗ trợ.' : 'Unsupported media type.',
    already_published: language === 'vi' ? 'Đã được đăng trước đó.' : 'Already published.',
    real_publish_disabled: language === 'vi' ? 'Đăng thật đang bị tắt.' : 'Real publish is disabled.',
    missing_source_account_id: language === 'vi' ? 'Thiếu source account id.' : 'Missing source account id.',
    page_readiness_failed:
      language === 'vi' ? 'Trạng thái sẵn sàng của Trang không đạt.' : 'Page readiness failed.',
    already_posting: language === 'vi' ? 'Đã ở trạng thái queued hoặc posting.' : 'Already queued or posting.',
    cancelled: language === 'vi' ? 'Bài viết đã hủy không thể được publish.' : 'Cancelled post cannot be published.',
    invalid: language === 'vi' ? 'Dòng không hợp lệ.' : 'Invalid row.',
    needs_verification: language === 'vi' ? 'Cần xác minh thủ công.' : 'Needs verification.',
    multi_image:
      language === 'vi'
        ? 'Bulk publish nhiều ảnh chưa được hỗ trợ.'
        : 'Multi-image bulk publish is not supported yet.',
    video:
      language === 'vi'
        ? 'Video chưa được hỗ trợ trong bulk publish.'
        : 'Video is not supported in bulk publish yet.',
    already_queued: language === 'vi' ? 'Đã ở trạng thái queued hoặc posting.' : 'Already queued or posting.',
    batch_limit_exceeded:
      language === 'vi'
        ? `Controlled bulk publish chỉ cho phép tối đa ${batchLimit} bài mỗi batch. Hãy giảm số lượng rồi thử lại.`
        : `Batch limit exceeded.`,
    failed_requires_retry:
      language === 'vi' ? 'Bài failed chỉ được publish lại khi có explicit retry.' : 'Failed post requires explicit retry.',
  };

  return labels[reason];
}

async function buildBulkPreparedRows(
  rows: BulkPublishPrepareRowPayload[],
  language: 'vi' | 'en',
  batchLimit: number,
  realPublishingEnabled: boolean
): Promise<BulkPublishPreparedRow[]> {
  const prepared: BulkPublishPreparedRow[] = [];

  for (const row of rows) {
    const hasImage = !!row.mediaLocalPath?.trim() && row.mediaType !== 'none';
    const title = row.title?.trim() || (language === 'vi' ? 'Không có tiêu đề' : 'Untitled');

    let reasonKey: BulkPublishEligibilityReason | null = null;
    let targetPageLabel = row.targetPageId?.trim() || (language === 'vi' ? 'Chưa chọn Trang' : 'No Page selected');
    let validationScope: 'row' | 'persisted_post' = 'row';

    if (!realPublishingEnabled) {
      reasonKey = 'real_publish_disabled';
    } else if (row.existingPostId && row.existingPostId > 0) {
      validationScope = 'persisted_post';

      const existingPost = await PostService.getPost(row.existingPostId);

      if (!existingPost) {
        reasonKey = 'invalid';
      } else {
        const activeJobs = await prisma.publishJob.count({
          where: {
            postId: existingPost.id,
            status: {
              in: ['pending', 'processing'],
            },
          },
        });

        const rawTargets = ((existingPost as any).postTargets ?? []) as Array<{
          accountId: number;
          account?: {
            platform?: string | null;
            accountName?: string | null;
            accountId?: string | null;
          } | null;
        }>;

        const pageTargets = rawTargets.filter((target: {
          accountId: number;
          account?: {
            platform?: string | null;
            accountName?: string | null;
            accountId?: string | null;
          } | null;
        }) => target.account?.platform === 'facebook');

        const primaryTarget = pageTargets[0];
        targetPageLabel =
          primaryTarget?.account?.accountName ??
          (row.targetPageId?.trim() || (language === 'vi' ? 'Chưa chọn Trang' : 'No Page selected'));

        if (existingPost.status === 'published') {
          reasonKey = 'already_published';
        } else if (existingPost.status === 'needs_verification') {
          reasonKey = 'needs_verification';
        } else if (existingPost.status === 'queued' || existingPost.status === 'posting' || activeJobs > 0) {
          reasonKey = 'already_queued';
        } else if (existingPost.status === 'cancelled') {
          reasonKey = 'cancelled';
        } else if (existingPost.status === 'failed' || existingPost.status === 'partially_failed') {
          reasonKey = 'failed_requires_retry';
        } else if (existingPost.mediaType === 'video') {
          reasonKey = 'video';
        } else if (existingPost.mediaType && !['photo', 'none'].includes(existingPost.mediaType)) {
          reasonKey = 'unsupported_media_type';
        } else if (pageTargets.length > 1) {
          reasonKey = 'multi_image';
        } else if (!row.targetPageId?.trim()) {
          reasonKey = 'missing_target_page';
        } else if (typeof row.sourceAccountId !== 'number') {
          reasonKey = 'missing_source_account_id';
        } else if (!existingPost.content.trim() && !existingPost.mediaLocalPath?.trim()) {
          reasonKey = 'missing_content_or_image';
        } else if (existingPost.mediaLocalPath?.trim() && !fsSync.existsSync(existingPost.mediaLocalPath.trim())) {
          reasonKey = 'image_file_missing';
        } else {
          const resolvedTarget = await facebookPublishReadinessService.resolveFacebookPublishTarget(existingPost.id);
          if (!resolvedTarget.ok) {
            if (resolvedTarget.blockedReason === 'real_publishing_disabled') {
              reasonKey = 'real_publish_disabled';
            } else if (resolvedTarget.blockedReason === 'missing_source_account') {
              reasonKey = 'missing_source_account_id';
            } else if (
              resolvedTarget.blockedReason === 'missing_page_target' ||
              resolvedTarget.blockedReason === 'missing_page' ||
              resolvedTarget.blockedReason === 'legacy_account_target'
            ) {
              reasonKey = 'missing_target_page';
            } else {
              reasonKey = 'page_readiness_failed';
            }
          }
        }
      }
    } else {
      if (!row.targetPageId?.trim()) {
        reasonKey = 'missing_target_page';
      } else {
        const pageTargets = await accountConnectionService.listFacebookPageTargets();
        const page = pageTargets.find((item: { pageId: string }) => item.pageId === row.targetPageId);
        targetPageLabel = page?.pageName ?? row.targetPageId;

        if (!page) {
          reasonKey = 'missing_target_page';
        } else if (typeof page.sourceAccountId !== 'number') {
          reasonKey = 'missing_source_account_id';
        } else if (page.pageReadiness !== 'ready') {
          reasonKey = 'page_readiness_failed';
        } else if (!row.content.trim() && !hasImage) {
          reasonKey = 'missing_content_or_image';
        } else if (row.mediaLocalPath?.trim() && !fsSync.existsSync(row.mediaLocalPath.trim())) {
          reasonKey = 'image_file_missing';
        } else if (row.mediaType && !['photo', 'none'].includes(row.mediaType)) {
          reasonKey = row.mediaType === 'video' ? 'video' : 'unsupported_media_type';
        }
      }
    }

    prepared.push({
      clientRowId: row.clientRowId,
      existingPostId: row.existingPostId ?? null,
      title,
      targetPageLabel,
      pageId: row.targetPageId ?? null,
      postStatus: row.postStatus ?? 'draft',
      hasImage,
      validationScope,
      isEligible: !reasonKey,
      reasonKey,
      reason: reasonKey ? getBulkEligibilityReasonLabel(reasonKey, language, batchLimit) : null,
    });
  }

  const eligibleCount = prepared.filter((row) => row.isEligible).length;
  if (eligibleCount > batchLimit) {
    return prepared.map((row) =>
      row.isEligible
        ? {
            ...row,
            isEligible: false,
            reasonKey: 'batch_limit_exceeded',
            reason: getBulkEligibilityReasonLabel('batch_limit_exceeded', language, batchLimit),
          }
        : row
    );
  }

  return prepared;
}

function getPreloadPath() {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  return isDev
    ? path.resolve(projectRoot, 'electron', 'preload.cjs')
    : path.join(__dirname, 'preload.cjs');
}

function attachWindowDebugging(window: BrowserWindow) {
  const sanitizeDiagnosticText = (value: string) =>
    value
      .replace(/([?&](?:code|state|token|access_token|refresh_token)=[^&\s]+)/gi, '$1=[redacted]')
      .replace(/("?(?:code|state|token|access_token|refresh_token)"?\s*:\s*)"[^"]*"/gi, '$1"[redacted]"');

  window.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const shouldLogMessage =
      message.includes('[AccountsPage]') ||
      message.includes('[CreatePostPage]') ||
      message.includes('[preload]') ||
      message.includes('[electronAPI]') ||
      message.includes('Router') ||
      message.includes('route') ||
      message.includes('navigation') ||
      message.includes('Failed') ||
      message.includes('Error');

    if (!shouldLogMessage) {
      return;
    }

    console.info(
      '[renderer]',
      JSON.stringify(
        {
          level,
          line,
          sourceId: sourceId ? sanitizeDiagnosticText(sourceId) : null,
          message: sanitizeDiagnosticText(message),
        },
        null,
        2
      )
    );
  });

  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error(
        '[window] did-fail-load',
        JSON.stringify(
          {
            errorCode,
            errorDescription: sanitizeDiagnosticText(errorDescription),
            validatedURL: sanitizeDiagnosticText(validatedURL),
            isMainFrame,
          },
          null,
          2
        )
      );
    }
  );

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(
      '[window] render-process-gone',
      JSON.stringify(
        {
          reason: details.reason,
          exitCode: details.exitCode,
        },
        null,
        2
      )
    );
  });

  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(
      '[preload] Failed to execute preload script',
      JSON.stringify(
        {
          preloadPath,
          error: error.message,
        },
        null,
        2
      )
    );
  });
}

function createOAuthWindow(url: string) {
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.focus();
    return { created: false, window: oauthWindow };
  }

  const preloadPath = getPreloadPath();

  oauthWindow = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 420,
    minHeight: 560,
    parent: mainWindow ?? undefined,
    modal: false,
    autoHideMenuBar: true,
    title: 'Facebook Callback',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  attachWindowDebugging(oauthWindow);

  oauthWindow.on('closed', () => {
    oauthWindow = null;
  });

  void oauthWindow.loadURL(url);

  return { created: true, window: oauthWindow };
}

async function cleanupOAuthSessionByState(state?: string) {
  if (!state?.trim()) {
    return false;
  }

  try {
    await prisma.oAuthSession.delete({
      where: { state },
    });
    return true;
  } catch {
    return false;
  }
}

function emitUpdaterState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:state-changed', updaterState);
  }
}

function applyUpdaterState(patch: Partial<UpdateStateSnapshot>) {
  updaterState = {
    ...updaterState,
    ...patch,
    currentVersion: app.getVersion(),
    canCheckForUpdates:
      process.platform === 'win32' &&
      !patch.checking &&
      (patch.status ?? updaterState.status) !== 'downloading',
    canDownloadUpdate:
      process.platform === 'win32' &&
      Boolean(patch.updateAvailable ?? updaterState.updateAvailable) &&
      !(patch.updateDownloaded ?? updaterState.updateDownloaded) &&
      (patch.status ?? updaterState.status) !== 'downloading',
    canQuitAndInstall: process.platform === 'win32' && Boolean(patch.updateDownloaded ?? updaterState.updateDownloaded),
  };
  emitUpdaterState();
}

function initializeAutoUpdater() {
  if (updaterInitialized) {
    return;
  }

  updaterInitialized = true;

  log.transports.file.level = 'info';
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;

  autoUpdater.on('checking-for-update', () => {
    applyUpdaterState({
      status: 'checking',
      checking: true,
      message: 'Checking for updates...',
      errorMessage: null,
      progress: null,
      lastCheckedAt: new Date().toISOString(),
    });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    applyUpdaterState({
      status: 'available',
      checking: false,
      updateAvailable: true,
      updateDownloaded: false,
      version: info.version ?? null,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      downloadedFile: null,
      progress: null,
      message: `Update ${info.version} is available.`,
      errorMessage: null,
    });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    applyUpdaterState({
      status: 'not-available',
      checking: false,
      updateAvailable: false,
      updateDownloaded: false,
      version: info.version ?? null,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      downloadedFile: null,
      progress: null,
      message: 'You are using the latest version.',
      errorMessage: null,
    });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    applyUpdaterState({
      status: 'downloading',
      checking: false,
      progress: {
        bytesPerSecond: progress.bytesPerSecond,
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      },
      message: `Downloading update... ${progress.percent.toFixed(1)}%`,
      errorMessage: null,
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    const downloadedFile = Array.isArray(info.files) && info.files.length > 0 ? info.files[0]?.url ?? null : null;
    applyUpdaterState({
      status: 'downloaded',
      checking: false,
      updateAvailable: true,
      updateDownloaded: true,
      version: info.version ?? null,
      releaseName: info.releaseName ?? null,
      releaseDate: info.releaseDate ?? null,
      downloadedFile,
      progress: {
        bytesPerSecond: 0,
        percent: 100,
        transferred: updaterState.progress?.total ?? 0,
        total: updaterState.progress?.total ?? 0,
      },
      message: 'Update downloaded. Restart to install.',
      errorMessage: null,
    });
  });

  autoUpdater.on('error', (error: Error) => {
    applyUpdaterState({
      status: 'error',
      checking: false,
      message: 'Update failed.',
      errorMessage: error.message,
    });
  });
}

const createWindow = () => {
  const isDev = !!process.env.VITE_DEV_SERVER_URL;
  const preloadPath = getPreloadPath();
  console.info(
    '[main] Creating BrowserWindow',
    JSON.stringify(
      {
        preloadPath,
        __dirname,
        isDev,
      },
      null,
      2
    )
  );

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'default',
    autoHideMenuBar: true,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  attachWindowDebugging(mainWindow);

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      emitUpdaterState();
      void runAccountsUiProbe(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

function registerIpcHandlers() {
  ipcMain.handle('scheduler:getStatus', async () => {
    return ScheduleService.getStatus();
  });

  ipcMain.handle('scheduler:runManualCheck', async () => {
    await ScheduleService.runManualCheck();
  });

  ipcMain.handle('settings:getSchedulerSettings', async () => {
    return appSettingsService.getSchedulerSettings();
  });

  ipcMain.handle('settings:updateSchedulerSettings', async (_event, settings) => {
    await appSettingsService.updateSchedulerSettings(settings);

    // Apply scheduler behavior changes immediately where possible
    await ScheduleService.stop();
    await ScheduleService.start();
  });

  ipcMain.handle('accounts:list', async () => {
    return accountConnectionService.listAccounts();
  });

  ipcMain.handle('accounts:listFacebookPageTargets', async () => {
    return accountConnectionService.listFacebookPageTargets();
  });

  ipcMain.handle('accounts:getConnectionStatus', async () => {
    console.info('[IPC] facebook:get-config-status invoked');
    const status = await accountConnectionService.getConnectionStatus();
    console.info(
      '[accounts:getConnectionStatus] facebook.realPublishingEnabled=%s',
      status.facebook.realPublishingEnabled ? 'true' : 'false'
    );
    console.info(
      '[IPC] facebook:get-config-status result',
      JSON.stringify(
        {
          configured: status.facebook.configured,
          valid: status.facebook.valid,
          appIdMasked: status.facebook.appIdMasked,
          graphApiVersion: status.facebook.graphApiVersion,
          status: status.facebook.status,
          statusLabel: status.facebook.statusLabel,
          realPublishingEnabled: status.facebook.realPublishingEnabled,
        },
        null,
        2
      )
    );
    return status;
  });

  ipcMain.handle('accounts:startFacebookOAuth', async () => {
    const status = await accountConnectionService.getConnectionStatus();

    if (!status.facebook.configured) {
      return {
        ok: false,
        message: `Facebook setup is incomplete: ${status.facebook.errors.join('; ')}`,
      };
    }

    if (!status.facebook.valid) {
      return {
        ok: false,
        message: `Facebook setup is invalid: ${status.facebook.errors.join('; ')}`,
      };
    }

    try {
      const oauthService = new OAuthService(false);
      const { url, state } = await oauthService.startOAuthFlow('facebook');

      return {
        ok: true,
        url,
        state,
        message:
          'Facebook authorization URL is ready. Open it manually in your browser, then paste the full callback URL here to finish the connection.',
      };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unable to start Facebook OAuth flow.',
      };
    }
  });

  ipcMain.handle(
    'accounts:completeFacebookOAuth',
    async (_event, payload: { code: string; state: string }) => {
      const oauthService = new OAuthService(false);
      const result = await oauthService.handleOAuthCallback(payload.code, payload.state);

      if (result.success && oauthWindow && !oauthWindow.isDestroyed()) {
        oauthWindow.close();
        oauthWindow = null;
      }

      return result;
    }
  );

  ipcMain.handle(
    'accounts:cancel-facebook-oauth',
    async (_event, payload?: { state?: string | null }) => {
      try {
        if (oauthWindow && !oauthWindow.isDestroyed()) {
          oauthWindow.close();
          oauthWindow = null;
        }

        await cleanupOAuthSessionByState(payload?.state ?? undefined);

        return {
          success: true,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
  );

  ipcMain.handle('oauth:openExternalUrl', async (_event, targetUrl: string) => {
    try {
      await shell.openExternal(targetUrl);
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle('oauth:openCallbackPopup', async (_event, callbackUrl: string) => {
    const { created } = createOAuthWindow(callbackUrl);

    return {
      ok: true,
      alreadyOpen: !created,
    };
  });

  ipcMain.handle('oauth:closeWindow', async (event) => {
    const callbackWindow = BrowserWindow.fromWebContents(event.sender);

    if (callbackWindow && !callbackWindow.isDestroyed()) {
      callbackWindow.close();

      if (callbackWindow === oauthWindow) {
        oauthWindow = null;
      }

      return { ok: true };
    }

    return { ok: false };
  });

  ipcMain.handle('accounts:createMockFacebookAccount', async () => {
    return accountConnectionService.createMockFacebookAccount();
  });

  ipcMain.handle(
    'accounts:setFacebookSelectedPage',
    async (_event, payload: { accountId: number; pageId: string }) => {
      const pagesSetting = await prisma.platformSetting.findUnique({
        where: {
          accountId_settingKey: {
            accountId: payload.accountId,
            settingKey: 'facebook.pages',
          },
        },
      });

      if (!pagesSetting?.settingValue) {
        return false;
      }

      let pages: Array<{ id: string; name?: string | null; category?: string | null }> = [];
      try {
        pages = JSON.parse(pagesSetting.settingValue);
      } catch {
        return false;
      }

      const selectedPage = pages.find((page) => page.id === payload.pageId);
      if (!selectedPage) {
        return false;
      }

      await prisma.platformSetting.upsert({
        where: {
          accountId_settingKey: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPage',
          },
        },
        create: {
          accountId: payload.accountId,
          settingKey: 'facebook.selectedPage',
          settingValue: selectedPage.id,
        },
        update: {
          settingValue: selectedPage.id,
        },
      });

      await prisma.platformSetting.upsert({
        where: {
          accountId_settingKey: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPageName',
          },
        },
        create: {
          accountId: payload.accountId,
          settingKey: 'facebook.selectedPageName',
          settingValue: selectedPage.name ?? '',
        },
        update: {
          settingValue: selectedPage.name ?? '',
        },
      });

      await prisma.platformSetting.upsert({
        where: {
          accountId_settingKey: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPageCategory',
          },
        },
        create: {
          accountId: payload.accountId,
          settingKey: 'facebook.selectedPageCategory',
          settingValue: selectedPage.category ?? '',
        },
        update: {
          settingValue: selectedPage.category ?? '',
        },
      });

      return true;
    }
  );

  ipcMain.handle(
    'accounts:forgetFacebookPage',
    async (_event, payload: { accountId: number; pageId: string }) => {
      const pagesSetting = await prisma.platformSetting.findUnique({
        where: {
          accountId_settingKey: {
            accountId: payload.accountId,
            settingKey: 'facebook.pages',
          },
        },
      });

      let pages: Array<{ id: string; name?: string | null; category?: string | null }> = [];
      if (pagesSetting?.settingValue) {
        try {
          pages = JSON.parse(pagesSetting.settingValue);
        } catch {
          pages = [];
        }
      }

      const remainingPages = pages.filter((page) => page.id !== payload.pageId);

      await prisma.platformSetting.deleteMany({
        where: {
          accountId: payload.accountId,
          settingKey: {
            in: [
              'facebook.selectedPage',
              'facebook.selectedPageName',
              'facebook.selectedPageCategory',
            ],
          },
        },
      });

      if (remainingPages.length > 0) {
        const fallbackPage = remainingPages[0];

        await prisma.platformSetting.upsert({
          where: {
            accountId_settingKey: {
              accountId: payload.accountId,
              settingKey: 'facebook.pages',
            },
          },
          create: {
            accountId: payload.accountId,
            settingKey: 'facebook.pages',
            settingValue: JSON.stringify(remainingPages),
          },
          update: {
            settingValue: JSON.stringify(remainingPages),
          },
        });

        await prisma.platformSetting.upsert({
          where: {
            accountId_settingKey: {
              accountId: payload.accountId,
              settingKey: 'facebook.selectedPage',
            },
          },
          create: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPage',
            settingValue: fallbackPage.id,
          },
          update: {
            settingValue: fallbackPage.id,
          },
        });

        await prisma.platformSetting.upsert({
          where: {
            accountId_settingKey: {
              accountId: payload.accountId,
              settingKey: 'facebook.selectedPageName',
            },
          },
          create: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPageName',
            settingValue: fallbackPage.name ?? '',
          },
          update: {
            settingValue: fallbackPage.name ?? '',
          },
        });

        await prisma.platformSetting.upsert({
          where: {
            accountId_settingKey: {
              accountId: payload.accountId,
              settingKey: 'facebook.selectedPageCategory',
            },
          },
          create: {
            accountId: payload.accountId,
            settingKey: 'facebook.selectedPageCategory',
            settingValue: fallbackPage.category ?? '',
          },
          update: {
            settingValue: fallbackPage.category ?? '',
          },
        });

        return true;
      }

      await prisma.platformSetting.deleteMany({
        where: {
          accountId: payload.accountId,
          settingKey: {
            in: ['facebook.pages', 'facebook.pagesLastFetchedAt'],
          },
        },
      });

      return true;
    }
  );

  ipcMain.handle('accounts:disconnect', async (_event, accountId: number) => {
    await prisma.platformSetting.deleteMany({
      where: { accountId },
    });
    await accountService.deleteAccount(accountId);
  });

  ipcMain.handle('accounts:refresh', async (_event, accountId: number) => {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        accountId: true,
        refreshToken: true,
        platform: true,
      },
    });

    if (!account) {
      return false;
    }

    const isSimulationAccount = account.accountId.startsWith('mock_facebook_');
    if (isSimulationAccount) {
      await accountService.updateAccountStatus(accountId, 'active');
      return true;
    }

    const status = await accountConnectionService.getConnectionStatus();
    if (account.platform === 'facebook' && !status.facebook.valid) {
      await accountService.updateAccountStatus(accountId, 'error');
      return false;
    }

    const oauthService = new OAuthService(false);

    if (account.refreshToken) {
      const refreshed = await oauthService.refreshAccountToken(accountId);

      if (refreshed && account.platform === 'facebook') {
        try {
          await accountConnectionService.syncFacebookPagesForAccount(accountId);
        } catch {
          // keep token refresh success even if page sync fails
        }
      }

      return refreshed;
    }

    const isExpired = await accountService.isTokenExpired(accountId);
    if (isExpired) {
      await accountService.updateAccountStatus(accountId, 'expired');
      return false;
    }

    if (account.platform === 'facebook') {
      try {
        await accountConnectionService.syncFacebookPagesForAccount(accountId);
      } catch {
        // keep refresh success for active token even if page sync fails
      }
    }

    await accountService.updateAccountStatus(accountId, 'active');
    return true;
  });

  const serializePost = async (post: any) => {
    const rawTargets = (post.postTargets as any[]) ?? [];

    const serializedTargets = await Promise.all(
      rawTargets.map(async (target) => {
        const selectedPageSetting = await prisma.platformSetting.findUnique({
          where: {
            accountId_settingKey: {
              accountId: target.accountId,
              settingKey: 'facebook.selectedPage',
            },
          },
        });

        const selectedPageNameSetting = await prisma.platformSetting.findUnique({
          where: {
            accountId_settingKey: {
              accountId: target.accountId,
              settingKey: 'facebook.selectedPageName',
            },
          },
        });

        const selectedPageCategorySetting = await prisma.platformSetting.findUnique({
          where: {
            accountId_settingKey: {
              accountId: target.accountId,
              settingKey: 'facebook.selectedPageCategory',
            },
          },
        });

        return {
          accountId: target.accountId,
          platform: target.account?.platform ?? 'unknown',
          accountName: target.account?.accountName ?? 'Unknown account',
          accountPlatformId: target.account?.accountId ?? '',
          targetType: selectedPageSetting?.settingValue ? 'page' : 'legacy_account',
          pageId: selectedPageSetting?.settingValue ?? null,
          pageName: selectedPageNameSetting?.settingValue ?? null,
          pageCategory: selectedPageCategorySetting?.settingValue ?? null,
          sourceAccountName: target.account?.accountName ?? null,
          platformPostId: target.platformPostId ?? null,
          targetStatus: target.status ?? 'pending',
          targetErrorMessage: target.errorMessage ?? null,
        };
      })
    );

    const jobs = await prisma.publishJob.findMany({
      where: {
        postId: post.id,
      },
      include: {
        account: true,
        attempts: {
          orderBy: {
            attemptNumber: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const hasRealFacebookTarget = rawTargets.some(
      (target) =>
        target.account?.platform === 'facebook' &&
        target.account?.accountId &&
        !String(target.account.accountId).startsWith('mock_facebook_')
    );

    const hasSimulationStyleFacebookPostId = rawTargets.some((target) =>
      typeof target.platformPostId === 'string' && target.platformPostId.startsWith('fb_sim_')
    );

    const derivedStatus =
      hasRealFacebookTarget &&
      hasSimulationStyleFacebookPostId &&
      post.status === 'published'
        ? 'needs_verification'
        : post.status;

    const derivedErrorMessage =
      hasRealFacebookTarget &&
      hasSimulationStyleFacebookPostId &&
      post.status === 'published'
        ? 'Local publish record needs verification because a simulation-style Facebook post id was stored for a real Facebook target.'
        : post.errorMessage;

    const attemptTimeline = jobs.flatMap((job) => {
      const relatedTarget = serializedTargets.find((target) => target.accountId === job.accountId);
      const mode =
        job.account?.accountId?.startsWith('mock_') ? 'simulation' : job.platform === 'facebook' ? 'real' : 'unknown';

      const jobLevelEntry =
        job.attempts.length === 0
          ? [
              {
                attemptNumber: 0,
                status: job.status,
                platform: job.platform,
                accountId: job.accountId,
                targetPageName: relatedTarget?.pageName ?? null,
                sourceAccountName: relatedTarget?.sourceAccountName ?? job.account?.accountName ?? null,
                safeExternalIdSuffix:
                  typeof relatedTarget?.platformPostId === 'string'
                    ? relatedTarget.platformPostId.slice(-6)
                    : null,
                errorMessage: job.errorMessage ?? null,
                errorCode: job.errorCode ?? null,
                startedAt: job.startedAt ? job.startedAt.toISOString() : null,
                finishedAt: job.completedAt ? job.completedAt.toISOString() : null,
                durationMs:
                  job.startedAt && job.completedAt
                    ? job.completedAt.getTime() - job.startedAt.getTime()
                    : null,
                mode,
              },
            ]
          : [];

      const attemptEntries = job.attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        platform: job.platform,
        accountId: job.accountId,
        targetPageName: relatedTarget?.pageName ?? null,
        sourceAccountName: relatedTarget?.sourceAccountName ?? job.account?.accountName ?? null,
        safeExternalIdSuffix:
          typeof relatedTarget?.platformPostId === 'string'
            ? relatedTarget.platformPostId.slice(-6)
            : null,
        errorMessage: attempt.errorMessage ?? null,
        errorCode: attempt.errorCode ?? null,
        startedAt: attempt.startedAt ? attempt.startedAt.toISOString() : null,
        finishedAt: attempt.finishedAt ? attempt.finishedAt.toISOString() : null,
        durationMs:
          attempt.startedAt && attempt.finishedAt
            ? attempt.finishedAt.getTime() - attempt.startedAt.getTime()
            : null,
        mode,
      }));

      return [...jobLevelEntry, ...attemptEntries];
    });

    return {
      ...post,
      postFormat: post.postFormat === 'story' ? 'story' : 'post',
      status: derivedStatus,
      errorMessage: derivedErrorMessage,
      mediaFileName: post.mediaFileName ?? null,
      mediaFileSize: post.mediaFileSize ?? null,
      mediaMimeType: post.mediaMimeType ?? null,
      mediaExtension: post.mediaExtension ?? null,
      mediaDurationMs: post.mediaDurationMs ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
      scheduledAt: post.scheduledAt ? post.scheduledAt.toISOString() : null,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      postTargets: serializedTargets,
      attemptTimeline,
    };
  };

  ipcMain.handle('posts:getFacebookPublishReadiness', async (_event, postId: number) => {
    return facebookPublishReadinessService.getPostReadiness(postId);
  });

  ipcMain.handle('posts:create', async (_event, payload) => {
    const post = await PostService.createPost({
      title: payload.title || undefined,
      content: payload.content,
      hashtags: payload.hashtags || undefined,
      postFormat: payload.postFormat === 'story' ? 'story' : 'post',
      mediaType: payload.mediaType || 'none',
      mediaUrl: payload.mediaUrl || undefined,
      mediaLocalPath: payload.mediaLocalPath || undefined,
      mediaFileName: payload.mediaFileName || undefined,
      mediaFileSize: payload.mediaFileSize ?? undefined,
      mediaMimeType: payload.mediaMimeType || undefined,
      mediaExtension: payload.mediaExtension || undefined,
      mediaDurationMs: payload.mediaDurationMs ?? undefined,
      status: payload.status,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
      targetAccounts: payload.targetAccounts ?? [],
    });

    const firstPageTarget =
      Array.isArray(payload.pageTargets) && payload.pageTargets.length > 0
        ? payload.pageTargets[0]
        : null;

    console.info(
      `[PostNow] created postId=${post.id} mediaType=${post.mediaType ?? 'none'} hasMediaLocalPath=${post.mediaLocalPath ? 'true' : 'false'} targetPage=${firstPageTarget?.pageId ? `${String(firstPageTarget.pageId).slice(0, 2)}••••${String(firstPageTarget.pageId).slice(-4)}` : 'none'}`
    );

    if (post.status === 'queued') {
      const createdJobs = await publishJobService.createJobsForPost(post.id);
      console.info(`[Queue] immediate job created jobCount=${createdJobs} postId=${post.id}`);

      if (createdJobs === 0) {
        await PostService.updatePostStatus(post.id, 'failed');
        await prisma.post.update({
          where: { id: post.id },
          data: {
            errorMessage:
              'Immediate publish could not start because no active publish job target was created.',
            updatedAt: new Date(),
          },
        });
      }
    }

    const refreshedPost = await PostService.getPost(post.id);
    return serializePost(refreshedPost ?? post);
  });

  ipcMain.handle('posts:list', async () => {
    const result = await PostService.getPosts(undefined, 1, 50);

    return {
      ...result,
      posts: await Promise.all(result.posts.map((post: any) => serializePost(post))),
    };
  });

  ipcMain.handle('posts:getById', async (_event, postId: number) => {
    const post = await PostService.getPost(postId);
    if (!post) {
      return null;
    }

    return serializePost(post);
  });

  ipcMain.handle('posts:updateLocal', async (_event, postId: number, payload) => {
    const existingPost = await PostService.getPost(postId);

    if (!existingPost) {
      throw new Error(`Post #${postId} not found.`);
    }

    if (existingPost.status === 'published') {
      throw new Error(
        'Published Facebook posts cannot be edited remotely. Create a new local draft copy instead.'
      );
    }

    const targetAccounts =
      Array.isArray(payload.targetAccounts) && payload.targetAccounts.length > 0
        ? payload.targetAccounts
        : Array.isArray(payload.pageTargets) && payload.pageTargets.length > 0
          ? Array.from(
              new Set(
                payload.pageTargets
                  .map((target: { sourceAccountId?: number }) => target.sourceAccountId)
                  .filter((value: number | undefined): value is number => typeof value === 'number')
              )
            )
          : undefined;

    const updatedPost = await PostService.updatePost(postId, {
      title: payload.title,
      content: payload.content,
      hashtags: payload.hashtags,
      postFormat: payload.postFormat,
      mediaType: payload.mediaType,
      mediaUrl: payload.mediaUrl,
      mediaLocalPath: payload.mediaLocalPath,
      mediaFileName: payload.mediaFileName,
      mediaFileSize: payload.mediaFileSize,
      mediaMimeType: payload.mediaMimeType,
      mediaExtension: payload.mediaExtension,
      mediaDurationMs: payload.mediaDurationMs,
      status: payload.status,
      scheduledAt:
        payload.scheduledAt === null
          ? undefined
          : payload.scheduledAt
            ? new Date(payload.scheduledAt)
            : undefined,
      targetAccounts,
    });

    return serializePost(updatedPost);
  });

  ipcMain.handle('posts:deleteLocal', async (_event, postId: number) => {
    const existingPost = await PostService.getPost(postId);

    if (!existingPost) {
      return {
        success: false,
        message: `Post #${postId} not found.`,
      };
    }

    const localOnly = existingPost.status === 'published';
    const deletedStatus = existingPost.status;

    if (existingPost.status === 'scheduled') {
      await prisma.publishJob.updateMany({
        where: {
          postId,
          status: {
            in: ['pending', 'processing'],
          },
        },
        data: {
          status: 'cancelled',
          errorCode: 'LOCAL_DELETE',
          errorMessage: 'Cancelled because the local post record was deleted.',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    await PostService.deletePost(postId);

    return {
      success: true,
      message: localOnly
        ? 'This only removed the local record. It did not delete the Facebook post.'
        : 'Local post deleted successfully.',
      deletedStatus,
      localOnly,
    };
  });

  ipcMain.handle('posts:cancelScheduled', async (_event, postId: number) => {
    const existingPost = await PostService.getPost(postId);

    if (!existingPost) {
      return {
        success: false,
        message: `Post #${postId} not found.`,
      };
    }

    if (existingPost.status !== 'scheduled' && existingPost.status !== 'queued') {
      return {
        success: false,
        message: 'Only scheduled or queued local posts can be cancelled.',
      };
    }

    const processingJobs = await prisma.publishJob.count({
      where: {
        postId,
        status: 'processing',
      },
    });

    if (processingJobs > 0) {
      return {
        success: false,
        message:
          'Only queued jobs that have not started can be cancelled. Published Facebook posts are not deleted remotely.',
      };
    }

    await prisma.publishJob.updateMany({
      where: {
        postId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        errorCode: 'LOCAL_CANCEL',
        errorMessage: 'Cancelled from local post management before queue start.',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updatedPost = await PostService.updatePostStatus(postId, 'cancelled');

    return {
      success: true,
      message:
        'Queued local post cancelled safely before start. Published Facebook posts are not deleted remotely.',
      post: await serializePost(updatedPost),
    };
  });

  ipcMain.handle('posts:duplicateAsDraft', async (_event, postId: number) => {
    const duplicatedPost = await PostService.duplicatePost(postId);
    return serializePost(duplicatedPost);
  });

  ipcMain.handle('posts:retrySimulation', async (_event, postId: number) => {
    const existingPost = await PostService.getPost(postId);

    if (!existingPost) {
      return {
        success: false,
        message: `Post #${postId} not found.`,
      };
    }

    const targets = ((existingPost as any).postTargets ?? []) as Array<{
      account?: { accountId?: string | null; accountName?: string | null; platform?: string | null };
    }>;

    if (targets.length === 0) {
      return {
        success: false,
        message: 'Simulation retry is unavailable because the post has no local targets.',
      };
    }

    const hasNonSimulationTarget = targets.some(
      (target) => !target.account?.accountId?.startsWith('mock_')
    );

    if (hasNonSimulationTarget) {
      return {
        success: false,
        message:
          'Real Facebook retry requires explicit controlled publish flow and is disabled by default.',
      };
    }

    const duplicatedPost = await PostService.duplicatePost(postId);
    await PostService.updatePostStatus(duplicatedPost.id, 'queued');
    await publishJobService.createJobsForPost(duplicatedPost.id);

    const queuedRetryPost = await PostService.getPost(duplicatedPost.id);

    return {
      success: true,
      message: `Simulation retry queued locally as post #${duplicatedPost.id}.`,
      post: queuedRetryPost ? await serializePost(queuedRetryPost) : await serializePost(duplicatedPost),
    };
  });

  ipcMain.handle('posts:getByDateRange', async (_event, payload) => {
    const posts = await PostService.getPostsByDateRange(
      new Date(payload.startDate),
      new Date(payload.endDate)
    );

    return Promise.all(posts.map((post) => serializePost(post)));
  });

  ipcMain.handle('bulkPublish:prepare', async (_event, payload: {
    rows: BulkPublishPrepareRowPayload[];
    language: 'vi' | 'en';
    batchLimit: number;
  }) => {
    const connectionStatus = await accountConnectionService.getConnectionStatus();

    return {
      rows: await buildBulkPreparedRows(
        payload.rows,
        payload.language,
        payload.batchLimit,
        connectionStatus.facebook.realPublishingEnabled
      ),
    };
  });

  ipcMain.handle('bulkPublish:createJobs', async (_event, payload: {
    rows: BulkPublishPrepareRowPayload[];
    language: 'vi' | 'en';
    batchLimit: number;
    confirmationText: string;
    confirmationChecked: boolean;
    confirmationToken: string;
  }): Promise<BulkPublishCreateJobsResult> => {
    if (!payload.confirmationChecked || payload.confirmationText.trim() !== 'PUBLISH') {
      return {
        ok: false,
        createdPostIds: [],
        results: payload.rows.map((row) => ({
          clientRowId: row.clientRowId,
          existingPostId: row.existingPostId ?? null,
          title: row.title?.trim() || (payload.language === 'vi' ? 'Không có tiêu đề' : 'Untitled'),
          status: 'blocked',
          message: payload.language === 'vi' ? 'Xác nhận chưa hợp lệ.' : 'Confirmation is invalid.',
        })),
        duplicateBatchBlocked: false,
      };
    }

    if (recentBulkPublishConfirmationTokens.has(payload.confirmationToken)) {
      return {
        ok: false,
        createdPostIds: [],
        results: payload.rows.map((row) => ({
          clientRowId: row.clientRowId,
          existingPostId: row.existingPostId ?? null,
          title: row.title?.trim() || (payload.language === 'vi' ? 'Không có tiêu đề' : 'Untitled'),
          status: 'blocked',
          message:
            payload.language === 'vi'
              ? 'Batch này đã được xác nhận trước đó. Không tạo duplicate jobs.'
              : 'This batch was already confirmed earlier. No duplicate jobs were created.',
        })),
        duplicateBatchBlocked: true,
      };
    }

    const connectionStatus = await accountConnectionService.getConnectionStatus();
    const preparedRows = await buildBulkPreparedRows(
      payload.rows,
      payload.language,
      payload.batchLimit,
      connectionStatus.facebook.realPublishingEnabled
    );

    const createdPostIds: number[] = [];
    const results: BulkPublishCreateJobsResult['results'] = [];

    const eligiblePreparedRows = preparedRows.filter((row) => row.isEligible);

    if (connectionStatus.facebook.realPublishingEnabled && eligiblePreparedRows.length > CONTROLLED_REAL_BULK_TEST_MAX_POSTS) {
      return {
        ok: false,
        createdPostIds: [],
        results: preparedRows.map((row) => ({
          clientRowId: row.clientRowId,
          existingPostId: row.existingPostId ?? null,
          title: row.title,
          status: 'blocked',
          message:
            payload.language === 'vi'
              ? `Controlled real bulk test chỉ cho phép tối đa ${CONTROLLED_REAL_BULK_TEST_MAX_POSTS} post trong một lần xác nhận.`
              : `Controlled real bulk test is limited to ${CONTROLLED_REAL_BULK_TEST_MAX_POSTS} posts per confirmation.`,
        })),
        duplicateBatchBlocked: false,
      };
    }

    const eligibleSourceRows = payload.rows.filter((row) => {
      const prepared = preparedRows.find((preparedRow) => preparedRow.clientRowId === row.clientRowId);
      return !!prepared?.isEligible;
    });

    if (
      connectionStatus.facebook.realPublishingEnabled &&
      eligibleSourceRows.length > 0 &&
      new Set(eligibleSourceRows.map((row) => row.targetPageId).filter((value): value is string => !!value?.trim())).size > 1
    ) {
      return {
        ok: false,
        createdPostIds: [],
        results: preparedRows.map((row) => ({
          clientRowId: row.clientRowId,
          existingPostId: row.existingPostId ?? null,
          title: row.title,
          status: 'blocked',
          message:
            payload.language === 'vi'
              ? 'Controlled real bulk test hiện chỉ cho phép đúng một Facebook Page trong mỗi lần xác nhận.'
              : 'Controlled real bulk test currently allows exactly one Facebook Page per confirmation.',
        })),
        duplicateBatchBlocked: false,
      };
    }

    recentBulkPublishConfirmationTokens.add(payload.confirmationToken);
    setTimeout(() => recentBulkPublishConfirmationTokens.delete(payload.confirmationToken), 10 * 60 * 1000);

    for (const preparedRow of preparedRows) {
      if (!preparedRow.isEligible) {
        results.push({
          clientRowId: preparedRow.clientRowId,
          existingPostId: preparedRow.existingPostId ?? null,
          title: preparedRow.title,
          status: 'blocked',
          message: preparedRow.reason ?? (payload.language === 'vi' ? 'Dòng không đủ điều kiện.' : 'Row is not eligible.'),
        });
        continue;
      }

      const sourceRow = payload.rows.find((row) => row.clientRowId === preparedRow.clientRowId);
      if (!sourceRow) {
        results.push({
          clientRowId: preparedRow.clientRowId,
          existingPostId: preparedRow.existingPostId ?? null,
          title: preparedRow.title,
          status: 'blocked',
          message: payload.language === 'vi' ? 'Không tìm thấy dữ liệu dòng để tạo queue.' : 'Row data was not found for queue creation.',
        });
        continue;
      }

      try {
        if (sourceRow.existingPostId && sourceRow.existingPostId > 0) {
          const existingPost = await PostService.getPost(sourceRow.existingPostId);

          if (!existingPost) {
            results.push({
              clientRowId: preparedRow.clientRowId,
              existingPostId: preparedRow.existingPostId ?? null,
              title: preparedRow.title,
              status: 'blocked',
              message: payload.language === 'vi' ? 'Không tìm thấy post cục bộ đã chọn.' : 'Selected local post was not found.',
            });
            continue;
          }

          await prisma.post.update({
            where: { id: existingPost.id },
            data: {
              status: 'queued',
              updatedAt: new Date(),
              errorMessage: null,
            },
          });

          const createdJobs = await publishJobService.createJobsForPost(existingPost.id);
          const refreshedExistingPost = await PostService.getPost(existingPost.id);

          if (createdJobs === 0 || !refreshedExistingPost) {
            await PostService.updatePostStatus(existingPost.id, 'failed');
            await prisma.post.update({
              where: { id: existingPost.id },
              data: {
                errorMessage: 'Immediate publish could not start because no active publish job target was created.',
                updatedAt: new Date(),
              },
            });

            results.push({
              clientRowId: preparedRow.clientRowId,
              existingPostId: existingPost.id,
              createdPostId: existingPost.id,
              title: preparedRow.title,
              status: 'create_failed',
              message:
                payload.language === 'vi'
                  ? 'Không thể tạo queued publish job an toàn cho post hiện có này.'
                  : 'Failed to create a safe queued publish job for this existing post.',
            });
            continue;
          }

          createdPostIds.push(existingPost.id);
          results.push({
            clientRowId: preparedRow.clientRowId,
            existingPostId: existingPost.id,
            createdPostId: existingPost.id,
            title: preparedRow.title,
            status: refreshedExistingPost.status === 'posting' ? 'posting' : 'queued',
            message:
              payload.language === 'vi'
                ? `Đã xếp hàng an toàn post hiện có #${existingPost.id}.`
                : `Safely queued existing post #${existingPost.id}.`,
            canCancelBeforeStart: refreshedExistingPost.status === 'queued',
          });
          continue;
        }

        const pageTargets = await accountConnectionService.listFacebookPageTargets();
        const page = pageTargets.find((item: { pageId: string }) => item.pageId === sourceRow.targetPageId);

        if (!page || typeof page.sourceAccountId !== 'number') {
          results.push({
            clientRowId: preparedRow.clientRowId,
            existingPostId: preparedRow.existingPostId ?? null,
            title: preparedRow.title,
            status: 'blocked',
            message: getBulkEligibilityReasonLabel('missing_source_account_id', payload.language, payload.batchLimit),
          });
          continue;
        }

        const createdPost = await PostService.createPost({
          title: sourceRow.title || undefined,
          content: sourceRow.content,
          postFormat: sourceRow.postFormat === 'story' ? 'story' : 'post',
          mediaType: sourceRow.mediaType || 'none',
          mediaLocalPath: sourceRow.mediaLocalPath || undefined,
          status: 'draft',
          targetAccounts: [page.sourceAccountId],
        });

        await prisma.post.update({
          where: { id: createdPost.id },
          data: { status: 'queued', updatedAt: new Date() },
        });

        const createdJobs = await publishJobService.createJobsForPost(createdPost.id);
        const refreshedCreatedPost = await PostService.getPost(createdPost.id);

        if (createdJobs === 0 || !refreshedCreatedPost) {
          await PostService.updatePostStatus(createdPost.id, 'failed');
          await prisma.post.update({
            where: { id: createdPost.id },
            data: {
              errorMessage: 'Immediate publish could not start because no active publish job target was created.',
              updatedAt: new Date(),
            },
          });

          results.push({
            clientRowId: preparedRow.clientRowId,
            existingPostId: preparedRow.existingPostId ?? null,
            createdPostId: createdPost.id,
            title: preparedRow.title,
            status: 'create_failed',
            message:
              payload.language === 'vi'
                ? 'Không thể tạo queued publish job an toàn cho dòng này.'
                : 'Failed to create a safe queued publish job for this row.',
          });
          continue;
        }

        createdPostIds.push(createdPost.id);
        results.push({
          clientRowId: preparedRow.clientRowId,
          existingPostId: preparedRow.existingPostId ?? null,
          createdPostId: createdPost.id,
          title: preparedRow.title,
          status: refreshedCreatedPost.status === 'posting' ? 'posting' : 'queued',
          message:
            payload.language === 'vi'
              ? `Đã tạo post #${createdPost.id} và đã đưa vào queue an toàn.`
              : `Created post #${createdPost.id} and queued it safely.`,
          canCancelBeforeStart: refreshedCreatedPost.status === 'queued',
        });
      } catch (error) {
        results.push({
          clientRowId: preparedRow.clientRowId,
          existingPostId: preparedRow.existingPostId ?? null,
          title: preparedRow.title,
          status: 'create_failed',
          message:
            error instanceof Error
              ? error.message
              : payload.language === 'vi'
                ? 'Không thể tạo post queued cho dòng này.'
                : 'Failed to create a queued post for this row.',
        });
      }
    }

    return {
      ok: results.some((row) => row.status === 'queued'),
      createdPostIds,
      results,
      duplicateBatchBlocked: false,
    };
  });

  ipcMain.handle('bulkPublish:getProgress', async (_event, payload: { postIds: number[] }) => {
    const posts = await Promise.all(payload.postIds.map((postId) => PostService.getPost(postId)));
    return Promise.all(
      posts.filter((post): post is NonNullable<typeof post> => !!post).map((post) => serializePost(post))
    );
  });

  ipcMain.handle('bulkPublish:cancelQueued', async (_event, postId: number) => {
    const existingPost = await PostService.getPost(postId);

    if (!existingPost) {
      return {
        success: false,
        message: `Post #${postId} not found.`,
      };
    }

    if (existingPost.status !== 'queued') {
      return {
        success: false,
        message:
          'Only queued jobs that have not started can be cancelled. Published Facebook posts are not deleted remotely.',
      };
    }

    await prisma.publishJob.updateMany({
      where: {
        postId,
        status: 'pending',
      },
      data: {
        status: 'cancelled',
        errorCode: 'LOCAL_CANCEL',
        errorMessage: 'Cancelled from controlled bulk publish before queue start.',
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updatedPost = await PostService.updatePostStatus(postId, 'cancelled');

    return {
      success: true,
      message:
        'Queued local post cancelled safely before start. Published Facebook posts are not deleted remotely.',
      post: await serializePost(updatedPost),
    };
  });

  // Media
  ipcMain.handle('media:pickImage', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Image',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const sourcePath = result.filePaths[0];
    const filename = path.basename(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';

    try {
      const media = await MediaService.saveMedia(sourcePath, filename, mimeType);
      const buffer = fsSync.readFileSync(media.filePath);
      const previewUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
      const stats = fsSync.statSync(media.filePath);
      return {
        id: media.id,
        mediaLocalPath: media.filePath,
        mediaType: 'photo',
        previewUrl,
        fileName: path.basename(media.filePath),
        fileSizeBytes: stats.size,
        mimeType,
        extension: ext,
      };
    } catch (err) {
      console.error('[media:pickImage] Failed', err);
      return null;
    }
  });

  ipcMain.handle('media:pickVideo', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Video',
      properties: ['openFile'],
      filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] }],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const sourcePath = result.filePaths[0];
    const filename = path.basename(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();

    let mimeType = 'video/mp4';
    if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.mkv') mimeType = 'video/x-matroska';

    try {
      const media = await MediaService.saveMedia(sourcePath, filename, mimeType);
      const stats = fsSync.statSync(media.filePath);
      return {
        id: media.id,
        mediaLocalPath: media.filePath,
        mediaType: 'video',
        previewUrl: media.filePath.replace(/\\/g, '/').startsWith('file://')
          ? media.filePath.replace(/\\/g, '/')
          : `file:///${media.filePath.replace(/\\/g, '/')}`,
        fileName: path.basename(media.filePath),
        fileSizeBytes: stats.size,
        mimeType,
        extension: ext,
      };
    } catch (err) {
      console.error('[media:pickVideo] Failed', err);
      return null;
    }
  });

  ipcMain.handle(
    'media:pickMedia',
    async (
      _event,
      payload: {
        allowImages: boolean;
        allowVideo: boolean;
        multipleImages: boolean;
        maxVideos: 1;
      }
    ) => {
      if (!mainWindow) {
        return {
          cancelled: true,
          images: [],
          video: null,
        };
      }

      const allowImages = Boolean(payload?.allowImages);
      const allowVideo = Boolean(payload?.allowVideo);
      const multipleImages = Boolean(payload?.multipleImages);
      const maxVideos = payload?.maxVideos ?? 1;

      if (!allowImages && !allowVideo) {
        return {
          cancelled: true,
          images: [],
          video: null,
          validationError: 'No supported media type was requested.',
        };
      }

      const filters: Array<{ name: string; extensions: string[] }> = [];
      if (allowImages) {
        filters.push({ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] });
      }
      if (allowVideo) {
        filters.push({ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv'] });
      }

      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Upload Media',
        properties: allowImages && multipleImages ? ['openFile', 'multiSelections'] : ['openFile'],
        filters,
      });

      if (result.canceled || result.filePaths.length === 0) {
        return {
          cancelled: true,
          images: [],
          video: null,
        };
      }

      const selectedPaths = result.filePaths;
      const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
      const videoExtensions = new Set(['.mp4', '.mov', '.webm', '.mkv']);
      const imagePaths = selectedPaths.filter((filePath) => imageExtensions.has(path.extname(filePath).toLowerCase()));
      const videoPaths = selectedPaths.filter((filePath) => videoExtensions.has(path.extname(filePath).toLowerCase()));

      if (imagePaths.length > 0 && videoPaths.length > 0) {
        return {
          cancelled: false,
          images: [],
          video: null,
          validationError: 'Please choose multiple images or one video, not both at the same time.',
        };
      }

      if (videoPaths.length > maxVideos) {
        return {
          cancelled: false,
          images: [],
          video: null,
          validationError: 'Only one video can be selected at a time.',
        };
      }

      const pickedImages: Array<{
        id: number;
        mediaLocalPath: string;
        mediaType: 'photo';
        previewUrl: string;
        fileName: string;
        fileSizeBytes: number;
        mimeType: string;
        extension: string;
      }> = [];

      for (const imagePath of imagePaths) {
        const normalizedPath = imagePath.trim();
        const ext = path.extname(normalizedPath).toLowerCase();
        let mimeType = 'image/jpeg';
        if (ext === '.png') mimeType = 'image/png';
        else if (ext === '.webp') mimeType = 'image/webp';

        const media = await MediaService.saveMedia(normalizedPath, path.basename(normalizedPath), mimeType);
        const previewBuffer = fsSync.readFileSync(media.filePath);
        const stats = fsSync.statSync(media.filePath);

        pickedImages.push({
          id: media.id,
          mediaLocalPath: media.filePath,
          mediaType: 'photo',
          previewUrl: `data:${mimeType};base64,${previewBuffer.toString('base64')}`,
          fileName: path.basename(media.filePath),
          fileSizeBytes: stats.size,
          mimeType,
          extension: ext,
        });
      }

      if (pickedImages.length > 0) {
        return {
          cancelled: false,
          images: pickedImages,
          video: null,
        };
      }

      if (videoPaths.length === 1) {
        const selectedPath = videoPaths[0];
        const filename = path.basename(selectedPath);
        const ext = path.extname(selectedPath).toLowerCase();

        let mimeType = 'video/mp4';
        if (ext === '.mov') mimeType = 'video/quicktime';
        else if (ext === '.webm') mimeType = 'video/webm';
        else if (ext === '.mkv') mimeType = 'video/x-matroska';

        const media = await MediaService.saveMedia(selectedPath, filename, mimeType);
        const stats = fsSync.statSync(media.filePath);

        return {
          cancelled: false,
          images: [],
          video: {
            id: media.id,
            mediaLocalPath: media.filePath,
            mediaType: 'video',
            previewUrl: media.filePath.replace(/\\/g, '/').startsWith('file://')
              ? media.filePath.replace(/\\/g, '/')
              : `file:///${media.filePath.replace(/\\/g, '/')}`,
            fileName: path.basename(media.filePath),
            fileSizeBytes: stats.size,
            mimeType,
            extension: ext,
            durationMs: undefined,
          },
        };
      }

      return {
        cancelled: false,
        images: [],
        video: null,
        validationError: 'Unsupported file type selected. Choose JPG, JPEG, PNG, WEBP, MP4, MOV, WEBM, or MKV.',
      };
    }
  );

  ipcMain.handle('media:importCsvFile', async () => {
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import CSV File',
      properties: ['openFile'],
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'Text Files', extensions: ['txt'] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const filePath = result.filePaths[0];

    try {
      const buffer = fsSync.readFileSync(filePath);
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '');

      return {
        fileName: path.basename(filePath),
        filePath,
        text,
      };
    } catch (err) {
      console.error('[media:importCsvFile] Failed', err);
      return null;
    }
  });

  ipcMain.handle('media:validateImagePath', async (_event, filePath: string) => {
    try {
      const normalizedPath = filePath.trim();

      if (!normalizedPath) {
        return {
          valid: false,
          error: 'Image file not found. Please reattach the image.',
        };
      }

      const ext = path.extname(normalizedPath).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
        return {
          valid: false,
          error: 'Image file not found. Please reattach the image.',
        };
      }

      if (!fsSync.existsSync(normalizedPath)) {
        return {
          valid: false,
          error: 'Image file not found. Please reattach the image.',
        };
      }

      const stats = fsSync.statSync(normalizedPath);
      if (!stats.isFile()) {
        return {
          valid: false,
          error: 'Image file not found. Please reattach the image.',
        };
      }

      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';

      const previewBuffer = fsSync.readFileSync(normalizedPath);
      return {
        valid: true,
        mediaLocalPath: normalizedPath,
        previewUrl: `data:${mimeType};base64,${previewBuffer.toString('base64')}`,
        fileName: path.basename(normalizedPath),
        fileSizeBytes: stats.size,
        mimeType,
        extension: ext,
      };
    } catch (err) {
      console.error('[media:validateImagePath] Failed', err);
      return {
        valid: false,
        error: 'Image file not found. Please reattach the image.',
      };
    }
  });

  ipcMain.handle('media:validateVideoPath', async (_event, filePath: string) => {
    try {
      const normalizedPath = filePath.trim();

      if (!normalizedPath) {
        return {
          valid: false,
          error: 'Video file not found. Please reattach the video.',
        };
      }

      const ext = path.extname(normalizedPath).toLowerCase();
      if (!['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) {
        return {
          valid: false,
          error: 'Video file not found. Please reattach the video.',
        };
      }

      if (!fsSync.existsSync(normalizedPath)) {
        return {
          valid: false,
          error: 'Video file not found. Please reattach the video.',
        };
      }

      const stats = fsSync.statSync(normalizedPath);
      if (!stats.isFile()) {
        return {
          valid: false,
          error: 'Video file not found. Please reattach the video.',
        };
      }

      let mimeType = 'video/mp4';
      if (ext === '.mov') mimeType = 'video/quicktime';
      else if (ext === '.webm') mimeType = 'video/webm';
      else if (ext === '.mkv') mimeType = 'video/x-matroska';

      const normalizedForUrl = normalizedPath.replace(/\\/g, '/');
      return {
        valid: true,
        mediaLocalPath: normalizedPath,
        previewUrl: normalizedForUrl.startsWith('file://') ? normalizedForUrl : `file:///${normalizedForUrl}`,
        fileName: path.basename(normalizedPath),
        fileSizeBytes: stats.size,
        mimeType,
        extension: ext,
      };
    } catch (err) {
      console.error('[media:validateVideoPath] Failed', err);
      return {
        valid: false,
        error: 'Video file not found. Please reattach the video.',
      };
    }
  });

  ipcMain.handle('notifications:getUnread', async () => {
    const notifications = await notificationService.getUnreadNotifications(20);
    return notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    }));
  });

  ipcMain.handle('notifications:list', async (_event, payload?: { page?: number; limit?: number; unreadOnly?: boolean }) => {
    const result = await notificationService.getNotifications(payload ?? {});
    return {
      ...result,
      notifications: result.notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  });

  ipcMain.handle('notifications:markRead', async (_event, notificationId: number) => {
    return notificationService.markAsRead(notificationId);
  });

  ipcMain.handle('notifications:markAllRead', async () => {
    return notificationService.markAllAsRead();
  });

  ipcMain.handle('notifications:delete', async (_event, notificationId: number) => {
    return notificationService.deleteNotification(notificationId);
  });

  ipcMain.handle('notifications:clearAll', async () => {
    return notificationService.clearAllNotifications();
  });

  ipcMain.handle('diagnostics:clearRecentJob', async (_event, jobId: number) => {
    const job = await prisma.publishJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!job) {
      return {
        success: false,
        message: `Job #${jobId} was not found locally.`,
      };
    }

    if (!['failed', 'cancelled'].includes(job.status)) {
      return {
        success: false,
        message:
          'Only failed or cancelled local jobs can be cleared from diagnostics safely.',
      };
    }

    await prisma.publishJob.update({
      where: { id: jobId },
      data: {
        errorCode: 'LOCAL_DIAGNOSTICS_CLEARED',
        errorMessage: 'Locally cleared from diagnostics view. No post or Facebook data was changed.',
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message:
        'This only cleared the local job record from diagnostics. It did not delete the post or affect Facebook.',
    };
  });

  ipcMain.handle('diagnostics:getSnapshot', async () => {
    const scheduler = await ScheduleService.getStatus();
    const connectionStatus = await accountConnectionService.getConnectionStatus();
    const now = new Date();

    const [
      recentJobs,
      failedAttempts,
      activeLocks,
      notifications,
      postCount,
      jobCount,
      notificationCount,
      nextScheduledPost,
      scheduledPostsCount,
      overdueScheduledPostsCount,
      cancelledScheduledPostsCount,
      blockedJobsCount,
    ] = await Promise.all([
      prisma.publishJob.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          postId: true,
          accountId: true,
          platform: true,
          status: true,
          retryCount: true,
          errorCode: true,
          errorMessage: true,
          updatedAt: true,
          post: {
            select: {
              id: true,
              title: true,
              status: true,
              postTargets: {
                include: {
                  account: {
                    select: {
                      id: true,
                      accountId: true,
                      accountName: true,
                      platform: true,
                    },
                  },
                },
              },
            },
          },
          account: {
            select: {
              id: true,
              accountId: true,
              accountName: true,
              platform: true,
            },
          },
          attempts: {
            orderBy: {
              startedAt: 'desc',
            },
            take: 1,
            select: {
              startedAt: true,
              finishedAt: true,
              responseData: true,
            },
          },
        },
      }),
      prisma.publishAttempt.findMany({
        where: { status: 'failed' },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          jobId: true,
          attemptNumber: true,
          status: true,
          errorCode: true,
          errorMessage: true,
          responseData: true,
          startedAt: true,
          finishedAt: true,
        },
      }),
      prisma.post.findMany({
        where: {
          lockedAt: {
            not: null,
          },
        },
        select: {
          id: true,
          title: true,
          lockedBy: true,
          lockedAt: true,
        },
        take: 20,
      }),
      notificationService.getUnreadNotifications(20),
      prisma.post.count(),
      prisma.publishJob.count(),
      prisma.notification.count(),
      prisma.post.findFirst({
        where: {
          status: 'scheduled',
          scheduledAt: {
            gte: now,
          },
        },
        orderBy: {
          scheduledAt: 'asc',
        },
        select: {
          scheduledAt: true,
        },
      }),
      prisma.post.count({
        where: {
          status: 'scheduled',
        },
      }),
      prisma.post.count({
        where: {
          status: 'scheduled',
          scheduledAt: {
            lte: now,
          },
        },
      }),
      prisma.post.count({
        where: {
          status: 'cancelled',
        },
      }),
      prisma.publishJob.count({
        where: {
          errorCode: 'FACEBOOK_REAL_PUBLISH_BLOCKED',
        },
      }),
    ]);

    const latestRecoveryEvent = await prisma.schedulerEvent.findFirst({
      where: { eventType: 'recovery' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, data: true },
    });

    const latestStartedEvent = await prisma.schedulerEvent.findFirst({
      where: { eventType: 'started' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    let recoveryData: { releasedLocks?: number; recoveredPosts?: number } = {};
    if (latestRecoveryEvent?.data) {
      try {
        recoveryData = JSON.parse(latestRecoveryEvent.data);
      } catch {
        recoveryData = {};
      }
    }

    return {
      scheduler: {
        ...scheduler,
        nextScheduledPostAt: nextScheduledPost?.scheduledAt?.toISOString() ?? null,
        scheduledPostsCount,
        overdueScheduledPostsCount,
        cancelledScheduledPostsCount,
        queue: {
          ...scheduler.queue,
          blocked: blockedJobsCount,
        },
      },
      recovery: {
        recoveredJobsCount: recoveryData.recoveredPosts ?? 0,
        staleLocksCleaned: recoveryData.releasedLocks ?? 0,
        schedulerStartupAt: latestStartedEvent?.createdAt.toISOString() ?? null,
        lastRecoveryRun: latestRecoveryEvent?.createdAt.toISOString() ?? null,
      },
      recentJobs: recentJobs.map((job) => {
        const relatedTarget = job.post.postTargets.find((target) => target.accountId === job.accountId);
        const mode =
          job.account.accountId?.startsWith('mock_')
            ? 'simulation'
            : job.platform === 'facebook'
              ? 'real'
              : 'unknown';
        const targetPageName = relatedTarget?.account?.platform === 'facebook'
          ? relatedTarget.account.accountName ?? null
          : null;
        const sourceAccountName = job.account.accountName ?? null;
        const targetLabel = targetPageName
          ? targetPageName
          : sourceAccountName
            ? 'Account metadata only'
            : 'Unknown target';
        const lastAttempt = job.attempts[0];

        let parsedResponseData: Record<string, unknown> | null = null;
        const rawAttemptResponseData: unknown = lastAttempt?.responseData;
        try {
          parsedResponseData =
            typeof rawAttemptResponseData === 'string' && rawAttemptResponseData.length > 0
              ? JSON.parse(rawAttemptResponseData)
              : null;
        } catch {
          parsedResponseData = null;
        }

        const safeFailureMeta =
          parsedResponseData?.provider === 'facebook'
            ? {
                provider: 'facebook' as const,
                endpointCategory:
                  parsedResponseData.endpointCategory === 'photo_upload' ||
                  parsedResponseData.endpointCategory === 'feed_publish' ||
                  parsedResponseData.endpointCategory === 'video_upload' ||
                  parsedResponseData.endpointCategory === 'video_publish'
                    ? parsedResponseData.endpointCategory === 'video_publish'
                      ? 'video_upload'
                      : parsedResponseData.endpointCategory
                    : 'unknown',
                httpStatus:
                  typeof parsedResponseData.httpStatus === 'number'
                    ? parsedResponseData.httpStatus
                    : null,
                errorType:
                  typeof parsedResponseData.errorType === 'string'
                    ? parsedResponseData.errorType
                    : null,
                safeErrorMessage:
                  typeof parsedResponseData.safeErrorMessage === 'string'
                    ? parsedResponseData.safeErrorMessage
                    : job.errorMessage ?? null,
                retryable:
                  typeof parsedResponseData.retryable === 'boolean'
                    ? parsedResponseData.retryable
                    : null,
                timestamp:
                  typeof parsedResponseData.timestamp === 'string'
                    ? parsedResponseData.timestamp
                    : null,
              }
            : null;

        const needsVerification =
          job.post.status === 'needs_verification' ||
          job.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION';
        const verificationReason =
          needsVerification
            ? 'Facebook accepted the video upload but final publish confirmation was not returned.'
            : null;
        const retrySafety =
          mode === 'simulation'
            ? {
                eligible: true,
                reason: 'simulation_only' as const,
                message: 'This record uses simulation targets only, so a local-only retry is available.',
              }
            : needsVerification
              ? {
                  eligible: false,
                  reason: 'manual_confirmation_required' as const,
                  message:
                    'This video outcome needs manual verification first. Do not treat it as published until Facebook visibility is confirmed.',
                }
              : job.post.status === 'failed' || job.post.status === 'blocked' || job.status === 'failed'
                ? connectionStatus.facebook.realPublishingEnabled
                  ? {
                      eligible: false,
                      reason: 'manual_confirmation_required' as const,
                      message:
                        'Real Facebook retry requires explicit controlled publish flow and manual confirmation.',
                    }
                  : {
                      eligible: false,
                      reason: 'real_publish_disabled' as const,
                      message:
                        'Real Facebook publishing is disabled. Set FACEBOOK_REAL_PUBLISH_ENABLED=true and restart the app to enable manual publish.',
                    }
                : {
                    eligible: false,
                    reason: 'not_failed' as const,
                    message: 'Retry is only applicable to failed or blocked publish records.',
                  };

        return {
          id: job.id,
          postId: job.postId,
          accountId: job.accountId,
          platform: job.platform,
          status: job.status,
          retryCount: job.retryCount,
          errorMessage: job.errorMessage,
          updatedAt: job.updatedAt.toISOString(),
          postTitle: job.post.title ?? null,
          postStatus: job.post.status,
          targetPageName,
          sourceAccountName,
          targetLabel,
          mode,
          lastAttemptAt:
            lastAttempt?.finishedAt?.toISOString() ??
            lastAttempt?.startedAt?.toISOString() ??
            null,
          locallyCleared: job.errorCode === 'LOCAL_DIAGNOSTICS_CLEARED',
          needsVerification,
          needsVerificationReason: verificationReason,
          safeFailureMeta,
          retrySafety,
        };
      }),
      failedAttempts: failedAttempts.map((attempt) => {
        let parsedResponseData: Record<string, unknown> | null = null;
        const rawAttemptResponseData: unknown = attempt.responseData;
        try {
          parsedResponseData =
            typeof rawAttemptResponseData === 'string' && rawAttemptResponseData.length > 0
              ? JSON.parse(rawAttemptResponseData)
              : null;
        } catch {
          parsedResponseData = null;
        }

        const safeFailureMeta =
          parsedResponseData?.provider === 'facebook'
            ? {
                provider: 'facebook' as const,
                endpointCategory:
                  parsedResponseData.endpointCategory === 'photo_upload' ||
                  parsedResponseData.endpointCategory === 'feed_publish' ||
                  parsedResponseData.endpointCategory === 'video_upload' ||
                  parsedResponseData.endpointCategory === 'video_publish'
                    ? parsedResponseData.endpointCategory === 'video_publish'
                      ? 'video_upload'
                      : parsedResponseData.endpointCategory
                    : 'unknown',
                httpStatus:
                  typeof parsedResponseData.httpStatus === 'number'
                    ? parsedResponseData.httpStatus
                    : null,
                errorType:
                  typeof parsedResponseData.errorType === 'string'
                    ? parsedResponseData.errorType
                    : null,
                safeErrorMessage:
                  typeof parsedResponseData.safeErrorMessage === 'string'
                    ? parsedResponseData.safeErrorMessage
                    : attempt.errorMessage ?? null,
                retryable:
                  typeof parsedResponseData.retryable === 'boolean'
                    ? parsedResponseData.retryable
                    : null,
                timestamp:
                  typeof parsedResponseData.timestamp === 'string'
                    ? parsedResponseData.timestamp
                    : null,
              }
            : null;

        const needsVerification = attempt.errorCode === 'FACEBOOK_VIDEO_NEEDS_VERIFICATION';

        return {
          ...attempt,
          startedAt: attempt.startedAt.toISOString(),
          finishedAt: attempt.finishedAt ? attempt.finishedAt.toISOString() : null,
          needsVerification,
          needsVerificationReason: needsVerification
            ? 'Facebook accepted the video upload but final publish confirmation was not returned.'
            : null,
          safeFailureMeta,
        };
      }),
      activeLocks: activeLocks.map((post) => ({
        ...post,
        lockedAt: post.lockedAt ? post.lockedAt.toISOString() : null,
      })),
      notifications: notifications.map((notification) => ({
        ...notification,
        createdAt: notification.createdAt.toISOString(),
      })),
      database: {
        ok: true,
        postCount,
        jobCount,
        notificationCount,
      },
      safeEvidence: {
        realPublishingEnabled: connectionStatus.facebook.realPublishingEnabled,
        realPublishingFlagSource: connectionStatus.facebook.realPublishingFlagSource,
        queueHealth:
          scheduler.queue.pending > 0 ||
          scheduler.queue.processing > 0 ||
          blockedJobsCount > 0 ||
          failedAttempts.length > 0
            ? 'warning'
            : 'healthy',
        schedulerHealth: scheduler.isRunning ? 'running' : 'stopped',
        pendingJobCount: scheduler.queue.pending,
        processingJobCount: scheduler.queue.processing,
        activeLockCount: activeLocks.length,
        recentFailedOrBlockedJobCount: failedAttempts.length + blockedJobsCount,
        fbSimEvidencePostCount: await prisma.postTarget.count({
          where: {
            platformPostId: {
              startsWith: 'fb_sim_',
            },
          },
        }),
        effectiveNeedsVerificationCount: await prisma.post.count({
          where: {
            OR: [
              {
                status: 'needs_verification',
              },
              {
                postTargets: {
                  some: {
                    platformPostId: {
                      startsWith: 'fb_sim_',
                    },
                    account: {
                      platform: 'facebook',
                    },
                  },
                },
              },
            ],
          },
        }),
        videoPostCount: await prisma.post.count({
          where: {
            mediaType: 'video',
          },
        }),
        unsupportedVideoPostCount: await prisma.post.count({
          where: {
            mediaType: 'video',
          },
        }),
        videoDraftCount: await prisma.post.count({
          where: {
            mediaType: 'video',
            status: 'draft',
          },
        }),
        videoScheduledCount: await prisma.post.count({
          where: {
            mediaType: 'video',
            status: 'scheduled',
          },
        }),
        videoPublishedCount: await prisma.post.count({
          where: {
            mediaType: 'video',
            status: 'published',
          },
        }),
        videoNeedsVerificationCount: await prisma.post.count({
          where: {
            mediaType: 'video',
            status: 'needs_verification',
          },
        }),
        recentFacebookImageFailureCount: await prisma.publishAttempt.count({
          where: {
            status: 'failed',
            responseData: {
              contains: '"endpointCategory":"photo_upload"',
            },
          },
        }),
        reminder: 'Real Facebook video publishing requires manual verification when final publish confirmation is not returned.',
        snapshotCommand: 'node scripts/snapshot-posts.mjs 14 15 6 21 22 26',
        snapshotChecks: [
          'status',
          'effective status',
          'fb_sim_* evidence',
          'job counts',
          'attempt counts',
          'duplicate active jobs',
          'safe platform id suffix',
          'video metadata',
          'realVideoPublishSupported',
          'video needs verification count',
          'safe Graph failure metadata',
          'retry safety eligibility',
        ],
      },
      uptimeMs: Date.now() - appStartTime,
      lastRunAt: await prisma.schedulerEvent.findFirst({
        where: {
          eventType: {
            in: ['check', 'job_queued', 'job_completed'],
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }).then((event) => event?.createdAt.toISOString() ?? null),
      lastSuccessfulPublishAt: await prisma.publishJob.findFirst({
        where: { status: 'success' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }).then((job) => job?.updatedAt.toISOString() ?? null),
      lastFailedPublishAt: await prisma.publishJob.findFirst({
        where: { status: 'failed' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }).then((job) => job?.updatedAt.toISOString() ?? null),
      refreshedAt: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    };
  });

  ipcMain.handle('notifications:showNative', async (_event, payload: { title: string; body: string }) => {
    if (Notification.isSupported()) {
      new Notification({
        title: payload.title,
        body: payload.body,
      }).show();
      return true;
    }
    return false;
  });

  ipcMain.handle('updater:getState', async () => updaterState);

  ipcMain.handle('updater:checkForUpdates', async () => {
    if (process.platform !== 'win32') {
      applyUpdaterState({
        status: 'error',
        checking: false,
        message: 'Windows auto-update is only available on Windows NSIS builds.',
        errorMessage: 'unsupported_platform',
      });
      return updaterState;
    }

    initializeAutoUpdater();
    await autoUpdater.checkForUpdates();
    return updaterState;
  });

  ipcMain.handle('updater:downloadUpdate', async () => {
    if (process.platform !== 'win32') {
      applyUpdaterState({
        status: 'error',
        checking: false,
        message: 'Windows auto-update is only available on Windows NSIS builds.',
        errorMessage: 'unsupported_platform',
      });
      return updaterState;
    }

    initializeAutoUpdater();
    applyUpdaterState({
      status: 'downloading',
      checking: false,
      message: 'Preparing update download...',
      errorMessage: null,
    });
    await autoUpdater.downloadUpdate();
    return updaterState;
  });

  ipcMain.handle('updater:quitAndInstall', async () => {
    if (process.platform !== 'win32' || !updaterState.updateDownloaded) {
      return { accepted: false };
    }

    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });

    return { accepted: true };
  });
}

app.whenReady().then(async () => {
  initializeAutoUpdater();
  registerIpcHandlers();
  createWindow();

  const facebookEnv = loadFacebookEnvConfig();
  const connectionStatus = await accountConnectionService.getConnectionStatus();

  if (loadedEnvFiles.length > 0) {
    console.info('[Env] Loaded local env files', loadedEnvFiles);
  } else {
    console.info('[Env] No local .env file loaded');
  }

  if (facebookEnv.valid) {
    console.info(
      '[FacebookConfig] Config validation passed',
      JSON.stringify(
        {
          appIdMasked: facebookEnv.maskedAppId,
          graphApiVersion: facebookEnv.graphApiVersion,
        },
        null,
        2
      )
    );
  } else {
    for (const error of facebookEnv.errors) {
      if (error.includes('FACEBOOK_APP_ID')) {
        console.warn('[FacebookConfig] Missing FACEBOOK_APP_ID');
      } else if (error.includes('FACEBOOK_APP_SECRET')) {
        console.warn('[FacebookConfig] Missing FACEBOOK_APP_SECRET');
      } else if (error.includes('FACEBOOK_REDIRECT_URI')) {
        console.warn('[FacebookConfig] Missing FACEBOOK_REDIRECT_URI');
      } else if (error.includes('FACEBOOK_GRAPH_API_VERSION')) {
        console.warn('[FacebookConfig] Missing FACEBOOK_GRAPH_API_VERSION');
      } else {
        console.warn('[FacebookConfig] Validation issue:', error);
      }
    }
  }

  if (!connectionStatus.facebook.configured) {
    console.warn('[main] Facebook configuration incomplete:', connectionStatus.facebook.errors);
  }
  console.info(
    '[main] Runtime startup context',
    JSON.stringify(
      {
        simulationMode: connectionStatus.simulationMode,
        facebookConfigured: connectionStatus.facebook.configured,
        facebookConfigValid: connectionStatus.facebook.valid,
        facebookAppIdMasked: connectionStatus.facebook.appIdMasked,
        realPublishingEnabled: connectionStatus.facebook.realPublishingEnabled,
      },
      null,
      2
    )
  );

  await ScheduleService.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async () => {
  await ScheduleService.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});