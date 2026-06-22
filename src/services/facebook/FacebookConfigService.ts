import { OAuthConfig } from '@/types/oauth';

export const FACEBOOK_REQUIRED_PERMISSIONS = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
] as const;

 export const FACEBOOK_BASIC_LOGIN_SCOPES = [
   'public_profile',
   'email',
 ] as const;

export const FACEBOOK_PAGE_READY_SCOPES = [
  ...FACEBOOK_BASIC_LOGIN_SCOPES,
  ...FACEBOOK_REQUIRED_PERMISSIONS,
] as const;

export const FACEBOOK_DEFAULT_GRAPH_API_VERSION = 'v18.0';

export const FACEBOOK_REQUIRED_ENV_VARS = [
  'FACEBOOK_APP_ID',
  'FACEBOOK_APP_SECRET',
  'FACEBOOK_REDIRECT_URI',
  'FACEBOOK_GRAPH_API_VERSION',
] as const;

export const FACEBOOK_REAL_PUBLISH_ENABLED_ENV_VAR =
  'FACEBOOK_REAL_PUBLISH_ENABLED' as const;

type FacebookConfigState =
  | 'missing'
  | 'invalid'
  | 'ready'
  | 'oauth_not_connected'
  | 'oauth_connected'
  | 'token_expired';

const PLACEHOLDER_PATTERNS = [
  'your_facebook_app_id',
  'your_facebook_app_secret',
  'your_redirect_uri',
  'your_graph_api_version',
  'facebook_app_id_here',
  'facebook_app_secret_here',
  'facebook_redirect_uri_here',
  'facebook_graph_api_version_here',
  'replace_me',
  'changeme',
  'example',
  'sample',
  'test',
  'mock',
  'placeholder',
];

export interface FacebookEnvConfigSnapshot {
  appId: string;
  appSecret: string;
  redirectUri: string;
  graphApiVersion: string;
  maskedAppId: string | null;
  configured: boolean;
  valid: boolean;
  status: FacebookConfigState;
  errors: string[];
  warnings: string[];
  missingVars: string[];
  invalidVars: string[];
  requiredEnvVars: readonly string[];
  oauthConfig: OAuthConfig;
  realPublishingEnabled: boolean;
  realPublishingFlagSource: 'default_false' | '.env.local' | '.env' | 'shell';
}

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim();
}

function isPlaceholderValue(value: string): boolean {
  const normalized = normalize(value).toLowerCase();

  if (!normalized) {
    return false;
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isLikelyValidGraphVersion(value: string): boolean {
  return /^v\d+\.\d+$/.test(value);
}

function isLikelyValidRedirectUri(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

function parseBooleanEnv(value: string | undefined | null): boolean {
  const normalized = normalize(value).toLowerCase();

  if (!normalized) {
    return false;
  }

  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export function maskFacebookAppId(appId: string): string | null {
  const normalized = normalize(appId);

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 6) {
    return `${normalized.slice(0, 2)}***`;
  }

  return `${normalized.slice(0, 4)}••••${normalized.slice(-2)}`;
}

export function loadFacebookEnvConfig(): FacebookEnvConfigSnapshot {
  const appId = normalize(process.env.FACEBOOK_APP_ID || process.env.FACEBOOK_CLIENT_ID);
  const appSecret = normalize(
    process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET
  );
  const redirectUri = normalize(process.env.FACEBOOK_REDIRECT_URI);
  const graphApiVersion = normalize(
    process.env.FACEBOOK_GRAPH_API_VERSION || FACEBOOK_DEFAULT_GRAPH_API_VERSION
  );
  const rawRealPublishFlag = process.env[FACEBOOK_REAL_PUBLISH_ENABLED_ENV_VAR];
  const realPublishingEnabled = parseBooleanEnv(rawRealPublishFlag);
  const realPublishingFlagSource =
    (process.env.FACEBOOK_REAL_PUBLISH_FLAG_SOURCE as
      | 'default_false'
      | '.env.local'
      | '.env'
      | 'shell'
      | undefined) ?? 'default_false';

  const realPublishFlagMaskedStatus = rawRealPublishFlag
    ? parseBooleanEnv(rawRealPublishFlag)
      ? 'present:true'
      : normalize(rawRealPublishFlag)
        ? 'present:false_or_nonstandard'
        : 'missing'
    : 'missing';

  console.info(
    '[facebook-config] real publish flag status=%s',
    realPublishFlagMaskedStatus
  );
  console.info(
    '[facebook-config] parsed realPublishingEnabled=%s',
    realPublishingEnabled ? 'true' : 'false'
  );
  console.info(
    '[facebook-config] realPublishingFlagSource=%s',
    realPublishingFlagSource
  );

  const errors: string[] = [];
  const warnings: string[] = [];
  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  if (!appId) {
    missingVars.push('FACEBOOK_APP_ID');
    errors.push('FACEBOOK_APP_ID is missing.');
  } else if (isPlaceholderValue(appId)) {
    invalidVars.push('FACEBOOK_APP_ID');
    errors.push('FACEBOOK_APP_ID is using a placeholder value.');
  }

  if (!appSecret) {
    missingVars.push('FACEBOOK_APP_SECRET');
    errors.push('FACEBOOK_APP_SECRET is missing.');
  } else if (isPlaceholderValue(appSecret)) {
    invalidVars.push('FACEBOOK_APP_SECRET');
    errors.push('FACEBOOK_APP_SECRET is using a placeholder value.');
  }

  if (!redirectUri) {
    missingVars.push('FACEBOOK_REDIRECT_URI');
    errors.push('FACEBOOK_REDIRECT_URI is missing.');
  } else if (isPlaceholderValue(redirectUri)) {
    invalidVars.push('FACEBOOK_REDIRECT_URI');
    errors.push('FACEBOOK_REDIRECT_URI is using a placeholder value.');
  } else if (!isLikelyValidRedirectUri(redirectUri)) {
    invalidVars.push('FACEBOOK_REDIRECT_URI');
    errors.push(
      'FACEBOOK_REDIRECT_URI must be a valid HTTPS URL or a localhost callback URL.'
    );
  }

  if (!graphApiVersion) {
    missingVars.push('FACEBOOK_GRAPH_API_VERSION');
    errors.push('FACEBOOK_GRAPH_API_VERSION is missing.');
  } else if (isPlaceholderValue(graphApiVersion)) {
    invalidVars.push('FACEBOOK_GRAPH_API_VERSION');
    errors.push('FACEBOOK_GRAPH_API_VERSION is using a placeholder value.');
  } else if (!isLikelyValidGraphVersion(graphApiVersion)) {
    invalidVars.push('FACEBOOK_GRAPH_API_VERSION');
    errors.push('FACEBOOK_GRAPH_API_VERSION must look like v18.0.');
  }

  if (redirectUri.startsWith('http://') && !redirectUri.includes('localhost')) {
    warnings.push(
      'FACEBOOK_REDIRECT_URI is using HTTP outside localhost. Facebook production apps should use HTTPS.'
    );
  }

  const configured = missingVars.length === 0;
  const valid = errors.length === 0;

  return {
    appId,
    appSecret,
    redirectUri,
    graphApiVersion,
    maskedAppId: maskFacebookAppId(appId),
    configured,
    valid,
    status: !configured ? 'missing' : valid ? 'ready' : 'invalid',
    errors,
    warnings,
    missingVars,
    invalidVars,
    requiredEnvVars: FACEBOOK_REQUIRED_ENV_VARS,
    realPublishingEnabled,
    realPublishingFlagSource,
    oauthConfig: {
      clientId: appId,
      clientSecret: appSecret,
      redirectUri,
      scopes: [...FACEBOOK_PAGE_READY_SCOPES],
    },
  };
}