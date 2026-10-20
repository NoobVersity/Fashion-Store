import { SESSION_COOKIE } from './cookies.js';
import { resolveSession } from '../services/sessionService.js';

export function getSessionToken(req) {
  return req.cookies ? req.cookies[SESSION_COOKIE] : undefined;
}

/**
 * Protects every admin API endpoint. Hiding the UI link is not
 * security — this check (plus the session in the HTTP-only cookie) is.
 */
export function requireAdmin(req, res, next) {
  const token = getSessionToken(req);
  const session = resolveSession(token);
  if (!session) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  req.admin = { id: session.adminId, email: session.email };
  req.sessionToken = token;
  return next();
}
