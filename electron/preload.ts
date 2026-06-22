const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  platform: process.platform,

  diagnostics: {
    getSnapshot: () => ipcRenderer.invoke('diagnostics:getSnapshot'),
    clearRecentJob: (jobId: number) => ipcRenderer.invoke('diagnostics:clearRecentJob', jobId),
  },

  scheduler: {
    getStatus: () => ipcRenderer.invoke('scheduler:getStatus'),
    runManualCheck: () => ipcRenderer.invoke('scheduler:runManualCheck'),
  },

  settings: {
    getSchedulerSettings: () => ipcRenderer.invoke('settings:getSchedulerSettings'),
    updateSchedulerSettings: (settings: {
      interval?: number;
      autoPostingEnabled?: boolean;
      maxRetryAttempts?: number;
      baseRetryDelay?: number;
      notificationEnabled?: boolean;
      logRetentionDays?: number;
      simulationMode?: boolean;
    }) => ipcRenderer.invoke('settings:updateSchedulerSettings', settings),
  },

  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    listFacebookPageTargets: () => ipcRenderer.invoke('accounts:listFacebookPageTargets'),
    getConnectionStatus: () => ipcRenderer.invoke('accounts:getConnectionStatus'),
    startFacebookOAuth: () => ipcRenderer.invoke('accounts:startFacebookOAuth'),
    completeFacebookOAuth: (payload: { code: string; state: string }) =>
      ipcRenderer.invoke('accounts:completeFacebookOAuth', payload),
    cancelFacebookOAuth: (payload?: { state?: string | null }) =>
      ipcRenderer.invoke('accounts:cancel-facebook-oauth', payload),
    createMockFacebookAccount: () => ipcRenderer.invoke('accounts:createMockFacebookAccount'),
    setFacebookSelectedPage: (payload: { accountId: number; pageId: string }) =>
      ipcRenderer.invoke('accounts:setFacebookSelectedPage', payload),
    forgetFacebookPage: (payload: { accountId: number; pageId: string }) =>
      ipcRenderer.invoke('accounts:forgetFacebookPage', payload),
    disconnect: (accountId: number) => ipcRenderer.invoke('accounts:disconnect', accountId),
    refresh: (accountId: number) => ipcRenderer.invoke('accounts:refresh', accountId),
  },

  oauth: {
    openExternalUrl: (targetUrl: string) =>
      ipcRenderer.invoke('oauth:openExternalUrl', targetUrl),
    openCallbackPopup: (callbackUrl: string) =>
      ipcRenderer.invoke('oauth:openCallbackPopup', callbackUrl),
    closeWindow: () => ipcRenderer.invoke('oauth:closeWindow'),
  },

  bulkPublish: {
    prepare: (payload: {
      rows: Array<{
        clientRowId: string;
        title?: string;
        content: string;
        mediaType?: 'photo' | 'video' | 'none';
        mediaLocalPath?: string;
        targetPageId?: string;
        sourceAccountId?: number;
        postStatus?: 'draft' | 'scheduled';
        existingPostId?: number | null;
      }>;
      language: 'vi' | 'en';
      batchLimit: number;
    }) => ipcRenderer.invoke('bulkPublish:prepare', payload),
    createJobs: (payload: {
      rows: Array<{
        clientRowId: string;
        title?: string;
        content: string;
        mediaType?: 'photo' | 'video' | 'none';
        mediaLocalPath?: string;
        targetPageId?: string;
        sourceAccountId?: number;
        postStatus?: 'draft' | 'scheduled';
        existingPostId?: number | null;
      }>;
      language: 'vi' | 'en';
      batchLimit: number;
      confirmationText: string;
      confirmationChecked: boolean;
      confirmationToken: string;
    }) => ipcRenderer.invoke('bulkPublish:createJobs', payload),
    getProgress: (payload: { postIds: number[] }) => ipcRenderer.invoke('bulkPublish:getProgress', payload),
    cancelQueued: (postId: number) => ipcRenderer.invoke('bulkPublish:cancelQueued', postId),
  },

  media: {
    pickMedia: (payload: {
      allowImages: boolean;
      allowVideo: boolean;
      multipleImages: boolean;
      maxVideos: 1;
    }) => ipcRenderer.invoke('media:pickMedia', payload),
    pickImage: () => ipcRenderer.invoke('media:pickImage'),
    pickVideo: () => ipcRenderer.invoke('media:pickVideo'),
    importCsvFile: () => ipcRenderer.invoke('media:importCsvFile'),
    validateImagePath: (filePath: string) => ipcRenderer.invoke('media:validateImagePath', filePath),
    validateVideoPath: (filePath: string) => ipcRenderer.invoke('media:validateVideoPath', filePath),
  },

  posts: {
    getFacebookPublishReadiness: (postId: number) =>
      ipcRenderer.invoke('posts:getFacebookPublishReadiness', postId),
    create: (payload: {
      title?: string;
      content: string;
      hashtags?: string;
      mediaType?: 'photo' | 'video' | 'none';
      mediaUrl?: string;
      mediaLocalPath?: string;
      status: 'draft' | 'scheduled' | 'posting' | 'queued';
      scheduledAt?: string;
      targetAccounts?: number[];
      pageTargets?: Array<{
        platform: 'facebook';
        targetType: 'page';
        pageId: string;
        pageName: string;
        sourceAccountId: number;
        sourceAccountName?: string;
      }>;
    }) => ipcRenderer.invoke('posts:create', payload),
    list: () => ipcRenderer.invoke('posts:list'),
    getById: (postId: number) => ipcRenderer.invoke('posts:getById', postId),
    updateLocal: (
      postId: number,
      payload: {
        title?: string;
        content?: string;
        hashtags?: string;
        mediaType?: 'photo' | 'video' | 'none';
        mediaUrl?: string;
        mediaLocalPath?: string;
        status?: 'draft' | 'scheduled';
        scheduledAt?: string | null;
        targetAccounts?: number[];
        pageTargets?: Array<{
          platform: 'facebook';
          targetType: 'page';
          pageId: string;
          pageName: string;
          sourceAccountId: number;
          sourceAccountName?: string;
        }>;
      }
    ) => ipcRenderer.invoke('posts:updateLocal', postId, payload),
    deleteLocal: (postId: number) => ipcRenderer.invoke('posts:deleteLocal', postId),
    cancelScheduled: (postId: number) => ipcRenderer.invoke('posts:cancelScheduled', postId),
    duplicateAsDraft: (postId: number) => ipcRenderer.invoke('posts:duplicateAsDraft', postId),
    retrySimulation: (postId: number) => ipcRenderer.invoke('posts:retrySimulation', postId),
    getByDateRange: (payload: { startDate: string; endDate: string }) =>
      ipcRenderer.invoke('posts:getByDateRange', payload),
  },

  notifications: {
    getUnread: () => ipcRenderer.invoke('notifications:getUnread'),
    list: (payload?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
      ipcRenderer.invoke('notifications:list', payload),
    markRead: (notificationId: number) => ipcRenderer.invoke('notifications:markRead', notificationId),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
    delete: (notificationId: number) => ipcRenderer.invoke('notifications:delete', notificationId),
    clearAll: () => ipcRenderer.invoke('notifications:clearAll'),
    showNative: (payload: { title: string; body: string }) =>
      ipcRenderer.invoke('notifications:showNative', payload),
  },
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  console.info('[preload] electronAPI exposed', {
    namespaces: Object.keys(electronAPI).filter((key) => key !== 'platform'),
  });
} catch (error) {
  console.error('[preload] Failed to expose electronAPI', error);
}