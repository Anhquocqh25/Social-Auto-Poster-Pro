export const APP_DATABASE_FILENAME = 'social-auto-poster-pro.db';
export const RUNTIME_TEMPLATE_FILENAME = 'runtime-template.db';
export const CURRENT_DATABASE_SCHEMA_VERSION = 2;

export const REQUIRED_DATABASE_TABLES = [
  'Account',
  'Post',
  'PostTarget',
  'MediaLibrary',
  'Log',
  'Setting',
  'OAuthSession',
  'PlatformToken',
  'PlatformSetting',
  'PublishJob',
  'PublishAttempt',
  'SchedulerEvent',
  'Notification',
  'AppSetting',
] as const;

export const REQUIRED_POST_TARGET_COLUMNS = [
  'id',
  'postId',
  'accountId',
  'platform',
  'targetType',
  'pageId',
  'pageName',
  'sourceAccountName',
  'platformPostId',
  'status',
  'errorMessage',
  'createdAt',
  'updatedAt',
] as const;

export const REQUIRED_PUBLISH_JOB_COLUMNS = [
  'id',
  'postId',
  'accountId',
  'platform',
  'pageId',
  'pageName',
  'sourceAccountName',
  'status',
  'priority',
  'retryCount',
  'maxRetries',
  'nextRetryAt',
  'startedAt',
  'completedAt',
  'errorCode',
  'errorMessage',
  'createdAt',
  'updatedAt',
] as const;