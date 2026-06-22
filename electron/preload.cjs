const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  platform: process.platform,

  diagnostics: {
    getSnapshot: () => ipcRenderer.invoke('diagnostics:getSnapshot'),
    clearRecentJob: (jobId) => ipcRenderer.invoke('diagnostics:clearRecentJob', jobId),
  },

  scheduler: {
    getStatus: () => ipcRenderer.invoke('scheduler:getStatus'),
    runManualCheck: () => ipcRenderer.invoke('scheduler:runManualCheck'),
  },

  settings: {
    getSchedulerSettings: () => ipcRenderer.invoke('settings:getSchedulerSettings'),
    updateSchedulerSettings: (settings) =>
      ipcRenderer.invoke('settings:updateSchedulerSettings', settings),
  },

  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    listFacebookPageTargets: () => ipcRenderer.invoke('accounts:listFacebookPageTargets'),
    getConnectionStatus: () => ipcRenderer.invoke('accounts:getConnectionStatus'),
    startFacebookOAuth: () => ipcRenderer.invoke('accounts:startFacebookOAuth'),
    completeFacebookOAuth: (payload) =>
      ipcRenderer.invoke('accounts:completeFacebookOAuth', payload),
    cancelFacebookOAuth: (payload) =>
      ipcRenderer.invoke('accounts:cancel-facebook-oauth', payload),
    createMockFacebookAccount: () => ipcRenderer.invoke('accounts:createMockFacebookAccount'),
    setFacebookSelectedPage: (payload) =>
      ipcRenderer.invoke('accounts:setFacebookSelectedPage', payload),
    forgetFacebookPage: (payload) =>
      ipcRenderer.invoke('accounts:forgetFacebookPage', payload),
    disconnect: (accountId) => ipcRenderer.invoke('accounts:disconnect', accountId),
    refresh: (accountId) => ipcRenderer.invoke('accounts:refresh', accountId),
  },

  oauth: {
    openExternalUrl: (targetUrl) => ipcRenderer.invoke('oauth:openExternalUrl', targetUrl),
    openCallbackPopup: (callbackUrl) => ipcRenderer.invoke('oauth:openCallbackPopup', callbackUrl),
    closeWindow: () => ipcRenderer.invoke('oauth:closeWindow'),
  },

  bulkPublish: {
    prepare: (payload) => ipcRenderer.invoke('bulkPublish:prepare', payload),
    createJobs: (payload) => ipcRenderer.invoke('bulkPublish:createJobs', payload),
    getProgress: (payload) => ipcRenderer.invoke('bulkPublish:getProgress', payload),
    cancelQueued: (postId) => ipcRenderer.invoke('bulkPublish:cancelQueued', postId),
  },

  media: {
    pickImage: () => ipcRenderer.invoke('media:pickImage'),
    importCsvFile: () => ipcRenderer.invoke('media:importCsvFile'),
    validateImagePath: (filePath) => ipcRenderer.invoke('media:validateImagePath', filePath),
  },

  posts: {
    getFacebookPublishReadiness: (postId) =>
      ipcRenderer.invoke('posts:getFacebookPublishReadiness', postId),
    create: (payload) => ipcRenderer.invoke('posts:create', payload),
    list: () => ipcRenderer.invoke('posts:list'),
    getById: (postId) => ipcRenderer.invoke('posts:getById', postId),
    updateLocal: (postId, payload) => ipcRenderer.invoke('posts:updateLocal', postId, payload),
    deleteLocal: (postId) => ipcRenderer.invoke('posts:deleteLocal', postId),
    cancelScheduled: (postId) => ipcRenderer.invoke('posts:cancelScheduled', postId),
    duplicateAsDraft: (postId) => ipcRenderer.invoke('posts:duplicateAsDraft', postId),
    retrySimulation: (postId) => ipcRenderer.invoke('posts:retrySimulation', postId),
    getByDateRange: (payload) => ipcRenderer.invoke('posts:getByDateRange', payload),
  },

  notifications: {
    getUnread: () => ipcRenderer.invoke('notifications:getUnread'),
    list: (payload) => ipcRenderer.invoke('notifications:list', payload),
    markRead: (notificationId) => ipcRenderer.invoke('notifications:markRead', notificationId),
    markAllRead: () => ipcRenderer.invoke('notifications:markAllRead'),
    delete: (notificationId) => ipcRenderer.invoke('notifications:delete', notificationId),
    clearAll: () => ipcRenderer.invoke('notifications:clearAll'),
    showNative: (payload) => ipcRenderer.invoke('notifications:showNative', payload),
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