import crypto from 'node:crypto';
import { config } from '../config.js';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/**
 * Password hashing using Node's built-in scrypt (a memory-hard
 * password-hashing algorithm) with a per-password random salt and a
 * server-side pepper from SESSION_SECRET.
 *
 * Stored format: scrypt$<salt-hex>$<derived-key-hex>
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derived = crypto.scryptSync(String(password), salt + pepper(), KEY_LENGTH);
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== KEY_LENGTH) return false;
  const derived = crypto.scryptSync(String(password), salt + pepper(), KEY_LENGTH);
  return crypto.timingSafeEqual(derived, expected);
}

function pepper() {
  return config.sessionSecret;
}
