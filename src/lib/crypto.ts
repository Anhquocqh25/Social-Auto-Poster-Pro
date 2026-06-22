import crypto from 'crypto';

/**
 * Encryption utilities for securing sensitive data like OAuth tokens
 * Uses AES-256-GCM for authenticated encryption
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
// const AUTH_TAG_LENGTH = 16; // 128 bits for GCM
// const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits

// Get encryption key from environment or generate one
// In production, this should be stored securely (e.g., in system keychain)
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  
  if (envKey) {
    // Derive key from environment variable
    return crypto.pbkdf2Sync(
      envKey,
      'social-auto-poster-salt', // Fixed salt for key derivation
      100000,
      KEY_LENGTH,
      'sha256'
    );
  }
  
  // For development: use a fixed key (NOT for production!)
  return crypto.pbkdf2Sync(
    'dev-encryption-key-change-in-production',
    'social-auto-poster-salt',
    100000,
    KEY_LENGTH,
    'sha256'
  );
}

/**
 * Encrypt sensitive data
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(ciphertext: string): string {
  try {
    const key = getEncryptionKey();
    const parts = ciphertext.split(':');
    
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data for comparison (one-way)
 */
export function hash(data: string): string {
  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex');
}

/**
 * Generate a secure random string for OAuth state, CSRF tokens, etc.
 */
export function generateSecureRandom(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate PKCE code verifier and challenge
 * Used for OAuth 2.0 PKCE flow
 */
export function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = generateSecureRandom(32);
  
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  
  return { verifier, challenge };
}

/**
 * Securely compare two strings in constant time
 * Prevents timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLog(data: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  if (seen.has(data)) {
    return '[Circular]';
  }

  seen.add(data);

  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'key',
    'accessToken',
    'refreshToken',
    'apiKey',
    'clientSecret',
  ];

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLog(item, seen));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLog(value, seen);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
