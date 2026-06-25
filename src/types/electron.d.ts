export interface SchedulerStatusSnapshot {
  isRunning: boolean;
  isChecking: boolean;
  queue: {
    pending: number;
    processing: number;
    success: number;
    failed: number;
    cancelled: number;
    blocked?: number;
    isProcessing: boolean;
  };
}

export interface DiagnosticsSnapshot {
  scheduler: SchedulerStatusSnapshot & {
    nextScheduledPostAt?: string | null;
    scheduledPostsCount?: number;
    overdueScheduledPostsCount?: number;
    cancelledScheduledPostsCount?: number;
  };
  recovery: {
    recoveredJobsCount: number;
    staleLocksCleaned: number;
    schedulerStartupAt: string | null;
    lastRecoveryRun: string | null;
  };
  recentJobs: Array<{
    id: number;
    postId: number;
    accountId: number;
    platform: string;
    status: string;
    retryCount: number;
    errorMessage: string | null;
    updatedAt: string;
    postTitle: string | null;
    postStatus: string;
    targetPageName: string | null;
    sourceAccountName: string | null;
    targetLabel: string;
    mode: 'real' | 'simulation' | 'unknown';
    lastAttemptAt: string | null;
    locallyCleared: boolean;
    needsVerification?: boolean;
    needsVerificationReason?: string | null;
    safeFailureMeta?: {
      provider: 'facebook';
      endpointCategory: 'photo_upload' | 'feed_publish' | 'video_upload' | 'unknown';
      httpStatus: number | null;
      errorType: string | null;
      safeErrorMessage: string | null;
      retryable: boolean | null;
      timestamp: string | null;
    } | null;
    retrySafety?: {
      eligible: boolean;
      reason:
        | 'manual_confirmation_required'
        | 'real_publish_disabled'
        | 'simulation_only'
        | 'not_failed'
        | 'not_applicable';
      message: string;
    } | null;
  }>;
  failedAttempts: Array<{
    id: number;
    jobId: number;
    attemptNumber: number;
    status: string;
    errorCode: string | null;
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
    needsVerification?: boolean;
    needsVerificationReason?: string | null;
    safeFailureMeta?: {
      provider: 'facebook';
      endpointCategory: 'photo_upload' | 'feed_publish' | 'video_upload' | 'unknown';
      httpStatus: number | null;
      errorType: string | null;
      safeErrorMessage: string | null;
      retryable: boolean | null;
      timestamp: string | null;
    } | null;
  }>;
  activeLocks: Array<{
    id: number;
    title: string | null;
    lockedBy: string | null;
    lockedAt: string | null;
  }>;
  notifications: Array<{
    id: number;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }>;
  database: {
    ok: boolean;
    postCount: number;
    jobCount: number;
    notificationCount: number;
  };
  safeEvidence: {
    realPublishingEnabled: boolean;
    realPublishingFlagSource: 'default_false' | '.env.local' | '.env' | 'shell';
    queueHealth: 'healthy' | 'warning';
    schedulerHealth: 'running' | 'stopped';
    pendingJobCount: number;
    processingJobCount: number;
    activeLockCount: number;
    recentFailedOrBlockedJobCount: number;
    fbSimEvidencePostCount: number;
    effectiveNeedsVerificationCount: number;
    videoPostCount: number;
    unsupportedVideoPostCount: number;
    videoDraftCount: number;
    videoScheduledCount: number;
    videoPublishedCount: number;
    videoNeedsVerificationCount?: number;
    recentFacebookImageFailureCount?: number;
    reminder: string;
    snapshotCommand: string;
    snapshotChecks: string[];
  };
  uptimeMs: number;
  lastRunAt: string | null;
  lastSuccessfulPublishAt: string | null;
  lastFailedPublishAt: string | null;
  refreshedAt: string;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}

export interface SchedulerSettingsSnapshot {
  interval: number;
  autoPostingEnabled: boolean;
  maxRetryAttempts: number;
  baseRetryDelay: number;
  notificationEnabled: boolean;
  logRetentionDays: number;
  simulationMode: boolean;
}

export type FacebookPublishBlockedReason =
  | 'real_publishing_disabled'
  | 'real_publishing_not_implemented'
  | 'missing_page_target'
  | 'missing_source_account'
  | 'inactive_account'
  | 'missing_permissions'
  | 'missing_page'
  | 'missing_page_access_token'
  | 'legacy_account_target'
  | 'unsupported_target';

export interface FacebookPublishReadinessSnapshot {
  ready: boolean;
  blockedReason?: FacebookPublishBlockedReason;
  accountId?: number;
  pageIdMasked?: string;
  pageName?: string;
  missingPermissions?: string[];
  hasEncryptedPageToken?: boolean;
}

export interface PostTargetPageSnapshot {
  platform: 'facebook';
  targetType: 'page';
  accountId: number;
  pageId: string;
  pageName: string;
  sourceAccountName?: string;
}

export interface PostTargetSnapshot {
  accountId: number;
  platform: string;
  accountName: string;
  accountPlatformId: string;
  targetType: 'page' | 'legacy_account';
  pageId?: string | null;
  pageName?: string | null;
  pageCategory?: string | null;
  sourceAccountName?: string | null;
}

export interface PostSnapshot {
  id: number;
  title: string | null;
  content: string;
  postFormat?: 'post' | 'story';
  mediaType: string | null;
  mediaUrl: string | null;
  mediaLocalPath: string | null;
  mediaFileName: string | null;
  mediaFileSize: number | null;
  mediaMimeType: string | null;
  mediaExtension: string | null;
  mediaDurationMs: number | null;
  hashtags: string | null;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  postTargets?: PostTargetSnapshot[];
  attemptTimeline?: Array<{
    attemptNumber: number;
    status: string;
    platform: string;
    accountId: number;
    targetPageName?: string | null;
    sourceAccountName?: string | null;
    safeExternalIdSuffix?: string | null;
    errorMessage?: string | null;
    errorCode?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    durationMs?: number | null;
    mode: 'real' | 'simulation' | 'unknown';
  }>;
}

export interface FacebookPageSnapshot {
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
}

export interface AccountSnapshot {
  id: number;
  platform: string;
  accountId: string;
  accountName: string;
  avatarUrl: string | null;
  status: string;
  tokenExpiresAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  isSimulation?: boolean;
  tokenHealth?: 'healthy' | 'expiring' | 'expired' | 'missing';
  avatarPresent?: boolean;
  selectedPageId?: string | null;
  selectedPageName?: string | null;
  selectedPageCategory?: string | null;
  permissionsMissing?: string[];
  pageReadiness?: 'ready' | 'missing_permissions' | 'not_selected' | 'unknown';
  pagesFetched?: number;
  pagesLastFetchedAt?: string | null;
  authorizedPages?: FacebookPageSnapshot[];
}

export interface FacebookPageTargetOption {
  pageId: string;
  pageName: string | null;
  category: string | null;
  pictureUrl?: string | null;
  sourceAccountId: number;
  sourceAccountName: string;
  sourceAccountDbId: number;
  isSelected: boolean;
  pageReadiness: 'ready' | 'not_selected' | 'missing_permissions' | 'unknown';
}

export interface AccountConnectionStatusSnapshot {
  simulationMode: boolean;
  facebook: {
    available: boolean;
    configured: boolean;
    valid: boolean;
    appIdMasked: string | null;
    graphApiVersion: string;
    redirectUri: string;
    errors: string[];
    warnings: string[];
    missingVars: string[];
    invalidVars: string[];
    requiredEnvVars: string[];
    requiredPermissions: string[];
    status:
      | 'simulation_mode_active'
      | 'config_missing'
      | 'config_invalid'
      | 'oauth_not_connected'
      | 'oauth_connected'
      | 'token_expired';
    statusLabel: string;
    hasConnectedOAuth: boolean;
    tokenExpired: boolean;
    reconnectRequired: boolean;
    realPublishingEnabled: boolean;
    realPublishingFlagSource: 'default_false' | '.env.local' | '.env' | 'shell';
    permissionsGranted: boolean;
    missingPermissions: string[];
    grantedScopes: string[];
    selectedPage: {
      id: string;
      name: string | null;
    } | null;
    connectedAccount: {
      id: number;
      accountId: string;
      accountName: string;
      status: string;
      tokenExpiresAt: string | null;
    } | null;
    accountActive: boolean;
    pageCount: number;
    pageTokenExists: boolean;
    selectedPageExists: boolean;
    pagesLastFetchedAt: string | null;
    setupInstructions: string[];
    developerSetupUrl: string;
  };
  tiktok: {
    available: boolean;
    configured: false;
    message: string;
  };
}

export interface MockAccountCreateResult {
  account: AccountSnapshot;
  created: boolean;
}

export type BulkPublishEligibilityReason =
  | 'missing_target_page'
  | 'missing_content_or_image'
  | 'image_file_missing'
  | 'unsupported_media_type'
  | 'already_published'
  | 'real_publish_disabled'
  | 'missing_source_account_id'
  | 'page_readiness_failed'
  | 'already_posting'
  | 'cancelled'
  | 'invalid'
  | 'needs_verification'
  | 'multi_image'
  | 'video'
  | 'already_queued'
  | 'batch_limit_exceeded'
  | 'failed_requires_retry';

export interface BulkPublishPrepareRowPayload {
  clientRowId: string;
  title?: string;
  content: string;
  postFormat?: 'post' | 'story';
  mediaType?: 'photo' | 'video' | 'none';
  mediaLocalPath?: string;
  targetPageId?: string;
  sourceAccountId?: number;
  postStatus?: 'draft' | 'scheduled';
  existingPostId?: number | null;
}

export interface BulkPublishPreparedRow {
  clientRowId: string;
  existingPostId?: number | null;
  title: string;
  targetPageLabel: string;
  pageId?: string | null;
  postStatus: 'draft' | 'scheduled';
  hasImage: boolean;
  validationScope: 'row' | 'persisted_post';
  isEligible: boolean;
  reasonKey: BulkPublishEligibilityReason | null;
  reason: string | null;
}

export interface BulkPublishCreateJobsResultRow {
  clientRowId: string;
  existingPostId?: number | null;
  createdPostId?: number | null;
  title: string;
  status: 'queued' | 'posting' | 'published' | 'failed' | 'blocked' | 'cancelled' | 'creating' | 'create_failed';
  message: string;
  canCancelBeforeStart?: boolean;
}

export interface BulkPublishCreateJobsResult {
  ok: boolean;
  createdPostIds: number[];
  results: BulkPublishCreateJobsResultRow[];
  duplicateBatchBlocked: boolean;
}

export interface PickMediaRequest {
  allowImages: boolean;
  allowVideo: boolean;
  multipleImages: boolean;
  maxVideos: 1;
}

export interface PickedImageMediaItem {
  id: number;
  mediaLocalPath: string;
  mediaType: 'photo';
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
}

export interface PickedVideoMediaItem {
  id: number;
  mediaLocalPath: string;
  mediaType: 'video';
  previewUrl: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  extension: string;
  durationMs?: number;
}

export interface PickMediaResult {
  cancelled: boolean;
  images: PickedImageMediaItem[];
  video: PickedVideoMediaItem | null;
  validationError?: string;
}

export type UpdateAvailabilityStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateProgressSnapshot {
  bytesPerSecond: number;
  percent: number;
  transferred: number;
  total: number;
}

export interface UpdateStateSnapshot {
  status: UpdateAvailabilityStatus;
  checking: boolean;
  updateAvailable: boolean;
  updateDownloaded: boolean;
  version: string | null;
  currentVersion: string;
  releaseName: string | null;
  releaseDate: string | null;
  downloadedFile: string | null;
  progress: UpdateProgressSnapshot | null;
  message: string | null;
  errorMessage: string | null;
  canCheckForUpdates: boolean;
  canDownloadUpdate: boolean;
  canQuitAndInstall: boolean;
  lastCheckedAt: string | null;
}

export interface ElectronAPI {
  platform: string;
  diagnostics: {
    getSnapshot: () => Promise<DiagnosticsSnapshot>;
    clearRecentJob: (jobId: number) => Promise<{
      success: boolean;
      message: string;
    }>;
  };
  scheduler: {
    getStatus: () => Promise<SchedulerStatusSnapshot>;
    runManualCheck: () => Promise<void>;
  };
  settings: {
    getSchedulerSettings: () => Promise<SchedulerSettingsSnapshot>;
    updateSchedulerSettings: (
      settings: Partial<SchedulerSettingsSnapshot> & { simulationMode?: boolean }
    ) => Promise<void>;
  };
  updater: {
    getState: () => Promise<UpdateStateSnapshot>;
    checkForUpdates: () => Promise<UpdateStateSnapshot>;
    downloadUpdate: () => Promise<UpdateStateSnapshot>;
    quitAndInstall: () => Promise<{ accepted: boolean }>;
    onStateChanged: (listener: (state: UpdateStateSnapshot) => void) => () => void;
  };
  accounts: {
    list: () => Promise<AccountSnapshot[]>;
    listFacebookPageTargets: () => Promise<FacebookPageTargetOption[]>;
    getConnectionStatus: () => Promise<AccountConnectionStatusSnapshot>;
    startFacebookOAuth: () => Promise<{
      ok: boolean;
      url?: string;
      state?: string;
      message?: string;
    }>;
    completeFacebookOAuth: (payload: { code: string; state: string }) => Promise<{
      success: boolean;
      account?: {
        id: number;
        platform: string;
        accountId: string;
        accountName: string;
        avatarUrl?: string;
      };
      error?: string;
    }>;
    cancelFacebookOAuth: (payload?: { state?: string | null }) => Promise<{
      success: boolean;
      error?: string;
    }>;
    createMockFacebookAccount: () => Promise<MockAccountCreateResult>;
    setFacebookSelectedPage: (payload: { accountId: number; pageId: string }) => Promise<boolean>;
    forgetFacebookPage: (payload: { accountId: number; pageId: string }) => Promise<boolean>;
    disconnect: (accountId: number) => Promise<void>;
    refresh: (accountId: number) => Promise<boolean>;
  };
  oauth: {
    openExternalUrl: (targetUrl: string) => Promise<{
      ok: boolean;
      error?: string;
    }>;
    openCallbackPopup: (callbackUrl: string) => Promise<{
      ok: boolean;
      alreadyOpen: boolean;
    }>;
    closeWindow: () => Promise<{ ok: boolean }>;
  };
  posts: {
    getFacebookPublishReadiness: (postId: number) => Promise<FacebookPublishReadinessSnapshot>;
      create: (payload: {
        title?: string;
        content: string;
        postFormat?: 'post' | 'story';
        hashtags?: string;
        mediaType?: 'photo' | 'video' | 'none';
        mediaUrl?: string;
        mediaLocalPath?: string;
        mediaFileName?: string;
        mediaFileSize?: number;
        mediaMimeType?: string;
        mediaExtension?: string;
        mediaDurationMs?: number;
        status?: 'draft' | 'scheduled' | 'queued' | 'posting';
        scheduledAt?: string;
        targetAccounts?: number[];
        pageTargets?: PostTargetPageSnapshot[];
      }) => Promise<PostSnapshot>;
    list: () => Promise<{
      posts: PostSnapshot[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>;
    getById: (postId: number) => Promise<PostSnapshot | null>;
    updateLocal: (
      postId: number,
        payload: {
          title?: string;
          content?: string;
          postFormat?: 'post' | 'story';
          hashtags?: string;
          mediaType?: 'photo' | 'video' | 'none';
          mediaUrl?: string;
          mediaLocalPath?: string;
          mediaFileName?: string;
          mediaFileSize?: number;
          mediaMimeType?: string;
          mediaExtension?: string;
          mediaDurationMs?: number;
          status?: 'draft' | 'scheduled';
          scheduledAt?: string | null;
          targetAccounts?: number[];
          pageTargets?: PostTargetPageSnapshot[];
        }
    ) => Promise<PostSnapshot>;
    deleteLocal: (postId: number) => Promise<{
      success: boolean;
      message: string;
      deletedStatus?: string;
      localOnly?: boolean;
    }>;
    cancelScheduled: (postId: number) => Promise<{
      success: boolean;
      message: string;
      post?: PostSnapshot;
    }>;
    duplicateAsDraft: (postId: number) => Promise<PostSnapshot>;
    retrySimulation: (postId: number) => Promise<{
      success: boolean;
      message: string;
      post?: PostSnapshot;
    }>;
    getByDateRange: (payload: {
      startDate: string;
      endDate: string;
    }) => Promise<PostSnapshot[]>;
  };
  bulkPublish: {
    prepare: (payload: {
      rows: BulkPublishPrepareRowPayload[];
      language: 'vi' | 'en';
      batchLimit: number;
    }) => Promise<{
      rows: BulkPublishPreparedRow[];
    }>;
    createJobs: (payload: {
      rows: BulkPublishPrepareRowPayload[];
      language: 'vi' | 'en';
      batchLimit: number;
      confirmationText: string;
      confirmationChecked: boolean;
      confirmationToken: string;
    }) => Promise<BulkPublishCreateJobsResult>;
    getProgress: (payload: { postIds: number[] }) => Promise<PostSnapshot[]>;
    cancelQueued: (postId: number) => Promise<{
      success: boolean;
      message: string;
      post?: PostSnapshot;
    }>;
  };
  media: {
    pickMedia: (payload: PickMediaRequest) => Promise<PickMediaResult>;
    pickImage: () => Promise<PickedImageMediaItem | null>;
    pickVideo: () => Promise<PickedVideoMediaItem | null>;
    importCsvFile: () => Promise<{
      fileName: string;
      filePath: string;
      text: string;
    } | null>;
    validateImagePath: (filePath: string) => Promise<{
      valid: boolean;
      mediaLocalPath?: string;
      previewUrl?: string;
      fileName?: string;
      fileSizeBytes?: number;
      mimeType?: string;
      extension?: string;
      error?: string;
    }>;
    validateVideoPath: (filePath: string) => Promise<{
      valid: boolean;
      mediaLocalPath?: string;
      previewUrl?: string;
      fileName?: string;
      fileSizeBytes?: number;
      mimeType?: string;
      extension?: string;
      durationMs?: number;
      error?: string;
    }>;
  };
  notifications: {
    getUnread: () => Promise<DiagnosticsSnapshot['notifications']>;
    list: (payload?: { page?: number; limit?: number; unreadOnly?: boolean }) => Promise<{
      notifications: DiagnosticsSnapshot['notifications'];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>;
    markRead: (notificationId: number) => Promise<boolean>;
    markAllRead: () => Promise<number>;
    delete: (notificationId: number) => Promise<boolean>;
    clearAll: () => Promise<number>;
    showNative: (payload: { title: string; body: string }) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}