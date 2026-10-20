import crypto from 'node:crypto';
import { config } from '../config.js';
import { getDb } from '../database/db.js';

/**
 * Server-side sessions. The raw token only ever exists in the
 * browser's HTTP-only cookie; the database stores an HMAC of it, so a
 * leaked database dump cannot be replayed as a session.
 */

function tokenId(token) {
  return crypto.createHmac('sha256', config.sessionSecret).update(token).digest('hex');
}

function expiresAt() {
  return new Date(Date.now() + config.sessionTtlHours * 60 * 60 * 1000).toISOString();
}

export function createSession(adminId) {
  const db = getDb();
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare(
    'INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)'
  ).run(tokenId(token), adminId, expiresAt());
  return token;
}

/** Returns { adminId, email } or null. */
export function resolveSession(token) {
  if (!token) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.admin_id AS adminId, a.email AS email, s.expires_at AS expiresAt
         FROM sessions s
         JOIN admins a ON a.id = s.admin_id
        WHERE s.id = ?`
    )
    .get(tokenId(token));
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    destroySession(token);
    return null;
  }
  return { adminId: row.adminId, email: row.email };
}

export function destroySession(token) {
  if (!token) return;
  getDb().prepare('DELETE FROM sessions WHERE id = ?').run(tokenId(token));
}

export function destroySessionsForAdmin(adminId) {
  getDb().prepare('DELETE FROM sessions WHERE admin_id = ?').run(adminId);
}

export function cleanupExpiredSessions() {
  getDb()
    .prepare("DELETE FROM sessions WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')")
    .run();
}
