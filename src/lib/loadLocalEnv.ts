import fs from 'fs';
import path from 'path';

const ENV_FILES = ['.env.local', '.env'];
const PROJECT_ENV_PREFIXES = ['FACEBOOK_'];
const FACEBOOK_REAL_PUBLISH_ENABLED_ENV_VAR = 'FACEBOOK_REAL_PUBLISH_ENABLED';

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const equalsIndex = trimmed.indexOf('=');
  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function shouldOverrideProjectEnv(key: string) {
  return PROJECT_ENV_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export function loadLocalEnv(projectRoot: string) {
  const loadedFiles: string[] = [];
  let realPublishFlagSource: 'default_false' | '.env.local' | '.env' | 'shell' = 'default_false';

  for (const fileName of ENV_FILES) {
    const filePath = path.join(projectRoot, fileName);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      if (parsed.key === FACEBOOK_REAL_PUBLISH_ENABLED_ENV_VAR) {
        process.env[parsed.key] = parsed.value;
        realPublishFlagSource = fileName === '.env.local' ? '.env.local' : '.env';
        continue;
      }

      if (shouldOverrideProjectEnv(parsed.key)) {
        process.env[parsed.key] = parsed.value;
        continue;
      }

      if (!process.env[parsed.key]) {
        process.env[parsed.key] = parsed.value;
      }
    }

    loadedFiles.push(fileName);
  }

  if (
    !loadedFiles.includes('.env.local') &&
    !loadedFiles.includes('.env') &&
    typeof process.env[FACEBOOK_REAL_PUBLISH_ENABLED_ENV_VAR] === 'string'
  ) {
    realPublishFlagSource = 'shell';
  }

  return {
    loadedFiles,
    realPublishFlagSource,
  };
}
