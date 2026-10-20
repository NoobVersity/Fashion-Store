import { config } from '../config.js';

/**
 * CSRF defence-in-depth for state-changing admin endpoints:
 *   1. Cookies are SameSite=Lax (cross-site POSTs never carry them).
 *   2. When a browser sends an Origin header on a write, its hostname
 *      must match the request Host (or be localhost in development,
 *      where Vite proxies /api on another port).
 * Non-browser clients (tests, curl) send no Origin header and are
 * allowed through — they cannot be forced to attach cookies anyway.
 */
export function originCheck(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  const origin = req.headers.origin;
  if (!origin) return next();

  let originHost;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }

  const hostHeader = req.headers.host || '';
  const requestHost = hostHeader.split(':')[0];
  const isLocalDev =
    !config.isProduction &&
    (originHost === 'localhost' || originHost === '127.0.0.1');

  if (originHost !== requestHost && !isLocalDev) {
    return res.status(403).json({ error: 'Cross-origin request blocked.' });
  }
  return next();
}

/** Conservative security headers (no framework needed). */
export function securityHeaders(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
}
