import type {
  AccountConnectionStatusSnapshot,
  AccountSnapshot,
  BulkPublishCreateJobsResult,
  BulkPublishPreparedRow,
  DiagnosticsSnapshot,
  ElectronAPI,
  FacebookPageTargetOption,
  FacebookPublishReadinessSnapshot,
  MockAccountCreateResult,
  PickMediaResult,
  PostSnapshot,
  SchedulerSettingsSnapshot,
  SchedulerStatusSnapshot,
  UpdateStateSnapshot,
} from '@/types/electron';

const missingNamespaceWarnings = new Set<string>();
let cachedElectronApi: ElectronAPI | null = null;

function logMissingNamespace(namespace: string) {
  if (missingNamespaceWarnings.has(namespace)) {
    return;
  }

  missingNamespaceWarnings.add(namespace);
  console.warn(`[electronAPI] Missing namespace: ${namespace}. Falling back to safe renderer stub.`);
}

function unavailableError(namespace: string) {
  return new Error(
    `Electron IPC namespace "${namespace}" is unavailable. Ensure the preload script loaded correctly.`
  );
}

const emptySchedulerStatus: SchedulerStatusSnapshot = {
  isRunning: false,
  isChecking: false,
  queue: {
    pending: 0,
    processing: 0,
    success: 0,
    failed: 0,
    cancelled: 0,
    isProcessing: false,
  },
};

const emptyDiagnosticsSnapshot: DiagnosticsSnapshot = {
  scheduler: emptySchedulerStatus,
  recovery: {
    recoveredJobsCount: 0,
    staleLocksCleaned: 0,
    schedulerStartupAt: null,
    lastRecoveryRun: null,
  },
  recentJobs: [],
  failedAttempts: [],
  activeLocks: [],
  notifications: [],
  database: {
    ok: false,
    postCount: 0,
    jobCount: 0,
    notificationCount: 0,
  },
  safeEvidence: {
    realPublishingEnabled: false,
    realPublishingFlagSource: 'default_false',
    queueHealth: 'healthy',
    schedulerHealth: 'stopped',
    pendingJobCount: 0,
    processingJobCount: 0,
    activeLockCount: 0,
    recentFailedOrBlockedJobCount: 0,
    fbSimEvidencePostCount: 0,
    effectiveNeedsVerificationCount: 0,
    videoPostCount: 0,
    unsupportedVideoPostCount: 0,
    videoDraftCount: 0,
    videoScheduledCount: 0,
    videoPublishedCount: 0,
    reminder: 'Real Facebook video publishing is not supported yet.',
    snapshotCommand: 'node scripts/snapshot-posts.mjs 14 15 6',
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
    ],
  },
  uptimeMs: 0,
  lastRunAt: null,
  lastSuccessfulPublishAt: null,
  lastFailedPublishAt: null,
  refreshedAt: new Date(0).toISOString(),
  memoryUsage: {
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
  },
};

const emptySchedulerSettings: SchedulerSettingsSnapshot = {
  interval: 1,
  autoPostingEnabled: true,
  maxRetryAttempts: 3,
  baseRetryDelay: 1,
  notificationEnabled: true,
  logRetentionDays: 30,
  simulationMode: true,
};

const emptyUpdateState: UpdateStateSnapshot = {
  status: 'idle',
  checking: false,
  updateAvailable: false,
  updateDownloaded: false,
  version: null,
  currentVersion: '0.1.0',
  releaseName: null,
  releaseDate: null,
  downloadedFile: null,
  progress: null,
  message: 'Update service unavailable',
  errorMessage: null,
  canCheckForUpdates: false,
  canDownloadUpdate: false,
  canQuitAndInstall: false,
  lastCheckedAt: null,
};

const emptyAccountConnectionStatus: AccountConnectionStatusSnapshot = {
  simulationMode: true,
  facebook: {
    available: true,
    configured: false,
    valid: false,
    appIdMasked: null,
    graphApiVersion: 'v18.0',
    redirectUri: '',
    errors: ['Facebook connection status is unavailable'],
    warnings: [],
    missingVars: [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_REDIRECT_URI',
      'FACEBOOK_GRAPH_API_VERSION',
    ],
    invalidVars: [],
    requiredEnvVars: [
      'FACEBOOK_APP_ID',
      'FACEBOOK_APP_SECRET',
      'FACEBOOK_REDIRECT_URI',
      'FACEBOOK_GRAPH_API_VERSION',
    ],
    requiredPermissions: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
    ],
    status: 'simulation_mode_active',
    statusLabel: 'Simulation Mode Active',
    hasConnectedOAuth: false,
    tokenExpired: false,
    reconnectRequired: false,
    realPublishingEnabled: false,
    realPublishingFlagSource: 'default_false',
    permissionsGranted: false,
    missingPermissions: [
      'pages_show_list',
      'pages_manage_posts',
      'pages_read_engagement',
    ],
    grantedScopes: [],
    selectedPage: null,
    connectedAccount: null,
    accountActive: false,
    pageCount: 0,
    pageTokenExists: false,
    selectedPageExists: false,
    pagesLastFetchedAt: null,
    setupInstructions: [
      'Create a Facebook app in Meta for Developers.',
      'Configure Facebook Login and the exact redirect URI.',
      'Provide the required Facebook environment variables.',
      'Connect OAuth and verify manageable page access.',
    ],
    developerSetupUrl: 'https://developers.facebook.com/apps/',
  },
  tiktok: {
    available: false,
    configured: false,
    message: 'TikTok is coming in a later phase.',
  },
};

const unavailableDiagnostics = {
  getSnapshot: async () => {
    logMissingNamespace('diagnostics');
    return emptyDiagnosticsSnapshot;
  },
  clearRecentJob: async () => {
    logMissingNamespace('diagnostics');
    return {
      success: false,
      message: unavailableError('diagnostics').message,
    };
  },
};

const unavailableScheduler = {
  getStatus: async () => {
    logMissingNamespace('scheduler');
    return emptySchedulerStatus;
  },
  runManualCheck: async () => {
    logMissingNamespace('scheduler');
  },
};

const unavailableSettings = {
  getSchedulerSettings: async () => {
    logMissingNamespace('settings');
    return emptySchedulerSettings;
  },
  updateSchedulerSettings: async () => {
    logMissingNamespace('settings');
    throw unavailableError('settings');
  },
};

const unavailableUpdater = {
  getState: async (): Promise<UpdateStateSnapshot> => {
    logMissingNamespace('updater');
    return emptyUpdateState;
  },
  checkForUpdates: async (): Promise<UpdateStateSnapshot> => {
    logMissingNamespace('updater');
    return {
      ...emptyUpdateState,
      status: 'error',
      message: unavailableError('updater').message,
      errorMessage: unavailableError('updater').message,
    };
  },
  downloadUpdate: async (): Promise<UpdateStateSnapshot> => {
    logMissingNamespace('updater');
    return {
      ...emptyUpdateState,
      status: 'error',
      message: unavailableError('updater').message,
      errorMessage: unavailableError('updater').message,
    };
  },
  quitAndInstall: async () => {
    logMissingNamespace('updater');
    return {
      accepted: false,
    };
  },
  onStateChanged: (listener: (state: UpdateStateSnapshot) => void) => {
    logMissingNamespace('updater');
    listener(emptyUpdateState);
    return () => undefined;
  },
};

const unavailableAccounts = {
  list: async (): Promise<AccountSnapshot[]> => {
    logMissingNamespace('accounts');
    return [];
  },
  listFacebookPageTargets: async (): Promise<FacebookPageTargetOption[]> => {
    logMissingNamespace('accounts');
    return [];
  },
  getConnectionStatus: async (): Promise<AccountConnectionStatusSnapshot> => {
    logMissingNamespace('accounts');
    return emptyAccountConnectionStatus;
  },
  startFacebookOAuth: async () => {
    logMissingNamespace('accounts');
    return {
      ok: false,
      message: unavailableError('accounts').message,
    };
  },
  completeFacebookOAuth: async () => {
    logMissingNamespace('accounts');
    return {
      success: false,
      error: unavailableError('accounts').message,
    };
  },
  cancelFacebookOAuth: async () => {
    logMissingNamespace('accounts');
    return {
      success: false,
      error: unavailableError('accounts').message,
    };
  },
  createMockFacebookAccount: async (): Promise<MockAccountCreateResult> => {
    logMissingNamespace('accounts');
    throw unavailableError('accounts');
  },
  setFacebookSelectedPage: async () => {
    logMissingNamespace('accounts');
    return false;
  },
  forgetFacebookPage: async () => {
    logMissingNamespace('accounts');
    return false;
  },
  disconnect: async () => {
    logMissingNamespace('accounts');
    throw unavailableError('accounts');
  },
  refresh: async () => {
    logMissingNamespace('accounts');
    return false;
  },
};

const unavailableBulkPublish = {
  prepare: async (): Promise<{ rows: BulkPublishPreparedRow[] }> => {
    logMissingNamespace('bulkPublish');
    return {
      rows: [],
    };
  },
  createJobs: async (): Promise<BulkPublishCreateJobsResult> => {
    logMissingNamespace('bulkPublish');
    return {
      ok: false,
      createdPostIds: [],
      results: [],
      duplicateBatchBlocked: false,
    };
  },
  getProgress: async (): Promise<PostSnapshot[]> => {
    logMissingNamespace('bulkPublish');
    return [];
  },
  cancelQueued: async () => {
    logMissingNamespace('bulkPublish');
    return {
      success: false,
      message: unavailableError('bulkPublish').message,
    };
  },
};

const unavailableMedia = {
  pickMedia: async (): Promise<PickMediaResult> => {
    logMissingNamespace('media');
    return {
      cancelled: true,
      images: [],
      video: null,
      validationError: unavailableError('media').message,
    };
  },
  pickImage: async (): Promise<null> => {
    logMissingNamespace('media');
    return null;
  },
  pickVideo: async (): Promise<null> => {
    logMissingNamespace('media');
    return null;
  },
  importCsvFile: async (): Promise<null> => {
    logMissingNamespace('media');
    return null;
  },
  validateImagePath: async () => {
    logMissingNamespace('media');
    return {
      valid: false,
      error: 'Image file not found. Please reattach the image.',
    };
  },
  validateVideoPath: async () => {
    logMissingNamespace('media');
    return {
      valid: false,
      error: 'Real Facebook video publishing is not supported yet.',
    };
  },
};

const unavailableOAuth = {
  openExternalUrl: async () => {
    logMissingNamespace('oauth');
    return {
      ok: false,
      error: unavailableError('oauth').message,
    };
  },
  openCallbackPopup: async () => {
    logMissingNamespace('oauth');
    return {
      ok: false,
      alreadyOpen: false,
    };
  },
  closeWindow: async () => {
    logMissingNamespace('oauth');
    return {
      ok: false,
    };
  },
};

const unavailablePosts = {
  getFacebookPublishReadiness: async (): Promise<FacebookPublishReadinessSnapshot> => {
    logMissingNamespace('posts');
    return {
      ready: false,
      blockedReason: 'real_publishing_disabled',
      hasEncryptedPageToken: false,
    };
  },
  create: async (): Promise<PostSnapshot> => {
    logMissingNamespace('posts');
    throw unavailableError('posts');
  },
  list: async () => {
    logMissingNamespace('posts');
    return {
      posts: [] as PostSnapshot[],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    };
  },
  getById: async (): Promise<PostSnapshot | null> => {
    logMissingNamespace('posts');
    return null;
  },
  updateLocal: async (): Promise<PostSnapshot> => {
    logMissingNamespace('posts');
    throw unavailableError('posts');
  },
  deleteLocal: async () => {
    logMissingNamespace('posts');
    return {
      success: false,
      message: unavailableError('posts').message,
      localOnly: false,
    };
  },
  cancelScheduled: async () => {
    logMissingNamespace('posts');
    return {
      success: false,
      message: unavailableError('posts').message,
    };
  },
  duplicateAsDraft: async (): Promise<PostSnapshot> => {
    logMissingNamespace('posts');
    throw unavailableError('posts');
  },
  retrySimulation: async () => {
    logMissingNamespace('posts');
    return {
      success: false,
      message: unavailableError('posts').message,
    };
  },
  getByDateRange: async (): Promise<PostSnapshot[]> => {
    logMissingNamespace('posts');
    return [];
  },
};

const unavailableNotifications = {
  getUnread: async (): Promise<DiagnosticsSnapshot['notifications']> => {
    logMissingNamespace('notifications');
    return [];
  },
  list: async () => {
    logMissingNamespace('notifications');
    return {
      notifications: [] as DiagnosticsSnapshot['notifications'],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
  },
  markRead: async () => {
    logMissingNamespace('notifications');
    return false;
  },
  markAllRead: async () => {
    logMissingNamespace('notifications');
    return 0;
  },
  delete: async () => {
    logMissingNamespace('notifications');
    return false;
  },
  clearAll: async () => {
    logMissingNamespace('notifications');
    return 0;
  },
  showNative: async () => {
    logMissingNamespace('notifications');
    return false;
  },
};

export function getElectronAPI(): ElectronAPI {
  if (cachedElectronApi) {
    return cachedElectronApi;
  }

  const raw = window.electronAPI as Partial<ElectronAPI> | undefined;

  if (!raw) {
    console.warn('[electronAPI] window.electronAPI is unavailable. Using safe fallback object.');
  }

  cachedElectronApi = {
    platform: raw?.platform ?? 'unknown',
    diagnostics: raw?.diagnostics ?? unavailableDiagnostics,
    scheduler: raw?.scheduler ?? unavailableScheduler,
    settings: raw?.settings ?? unavailableSettings,
    updater: raw?.updater ?? unavailableUpdater,
    accounts: raw?.accounts ?? unavailableAccounts,
    oauth: raw?.oauth ?? unavailableOAuth,
    bulkPublish: raw?.bulkPublish ?? unavailableBulkPublish,
    media: raw?.media ?? unavailableMedia,
    posts: raw?.posts ?? unavailablePosts,
    notifications: raw?.notifications ?? unavailableNotifications,
  };

  return cachedElectronApi;
}
