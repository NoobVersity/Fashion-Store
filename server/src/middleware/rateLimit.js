import { config } from '../config.js';

/**
 * Fixed-window in-memory rate limiter (single-process, which is what
 * this MVP runs). Used to slow down credential stuffing on login.
 * Only failures should count — success resets the key.
 */
export function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();

  const keyFor = (req) => {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const email = req.body && req.body.email ? String(req.body.email).toLowerCase() : '';
    return `${ip}|${email}`;
  };

  function rateLimiter(req, res, next) {
    const key = keyFor(req);
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfter));
      return res
        .status(429)
        .json({ error: 'Too many login attempts. Please try again later.' });
    }
    return next();
  }

  rateLimiter.resetKey = (req) => buckets.delete(keyFor(req));
  rateLimiter.resetAll = () => buckets.clear();
  return rateLimiter;
}

export const loginLimiter = createRateLimiter({
  windowMs: config.loginWindowMs,
  max: config.loginMaxAttempts,
});
