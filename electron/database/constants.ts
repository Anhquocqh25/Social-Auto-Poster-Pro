export const APP_DATABASE_FILENAME = 'social-auto-poster-pro.db';
export const RUNTIME_TEMPLATE_FILENAME = 'runtime-template.db';
export const CURRENT_DATABASE_SCHEMA_VERSION = 1;

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