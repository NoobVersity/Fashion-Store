import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import {
  setSessionCookie,
  clearSessionCookie,
} from '../../middleware/cookies.js';
import {
  createSession,
  destroySession,
  destroySessionsForAdmin,
} from '../../services/sessionService.js';
import {
  hashPassword,
  verifyPassword,
} from '../../services/passwordService.js';
import { Validator } from '../../validation/validate.js';

const router = express.Router();

/**
 * POST /api/admin/auth/login — rate-limited, generic error messages
 * (never reveals whether an email exists).
 */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.email('email');
    v.string('password', { label: 'Password', max: 200 });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const admin = getDb()
      .prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE')
      .get(v.value.email);

    if (!admin || !verifyPassword(v.value.password, admin.password_hash)) {
      return res
        .status(401)
        .json({ error: 'Invalid email or password.' });
    }

    loginLimiter.resetKey(req); // successful login clears the counter
    const token = createSession(admin.id);
    setSessionCookie(res, token);
    return res.json({ admin: { id: admin.id, email: admin.email } });
  })
);

/** POST /api/admin/auth/logout — destroys the server-side session. */
router.post('/logout', (req, res) => {
  destroySession(req.cookies ? req.cookies.threads_session : undefined);
  clearSessionCookie(res);
  res.status(204).end();
});

/** GET /api/admin/auth/me */
router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

/**
 * POST /api/admin/auth/change-password — verifies the current
 * password, rotates all sessions for this admin, and issues a fresh
 * session cookie.
 */
router.post(
  '/change-password',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.string('currentPassword', { label: 'Current password', max: 200 });
    v.string('newPassword', {
      label: 'New password',
      min: 8,
      max: 200,
    });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const db = getDb();
    const admin = db
      .prepare('SELECT * FROM admins WHERE id = ?')
      .get(req.admin.id);
    if (!admin || !verifyPassword(v.value.currentPassword, admin.password_hash)) {
      return res
        .status(401)
        .json({ error: 'Current password is incorrect.' });
    }

    db.prepare(
      `UPDATE admins
          SET password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`
    ).run(hashPassword(v.value.newPassword), admin.id);

    destroySessionsForAdmin(admin.id);
    const token = createSession(admin.id);
    setSessionCookie(res, token);

    return res.json({ message: 'Password changed. Your session has been refreshed.' });
  })
);

export default router;
