import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../database/db.js';

/**
 * Customer sessions — identical HMAC-of-token scheme as the admin
 * sessions (see sessionService.js), kept separate so admin and
 * customer sign-ins never interfere with each other.
 */

function tokenId(token) {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

function expiresAt() {
  return new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000).toISOString();
}

export function createCustomerSession(customerId) {
  const token = crypto.randomBytes(32).toString('base64url');
  getDb()
    .prepare('INSERT INTO customer_sessions (id, customer_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenId(token), customerId, expiresAt());
  return token;
}

/** Returns { id, name, email, phone } or null. */
export function resolveCustomerSession(token) {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT s.customer_id AS id, c.name, c.email, c.phone, s.expires_at AS expiresAt
         FROM customer_sessions s
         JOIN customers c ON c.id = s.customer_id
        WHERE s.id = ?`
    )
    .get(tokenId(token));
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    destroyCustomerSession(token);
    return null;
  }
  return { id: row.id, name: row.name, email: row.email, phone: row.phone };
}

export function destroyCustomerSession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM customer_sessions WHERE id = ?').run(tokenId(token));
}
