import { config } from '../config.js';

export const SESSION_COOKIE = 'threads_session';
export const CUSTOMER_COOKIE = 'threads_customer_session';

/** Tiny cookie parser (no cookie-parser dependency). */
export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key && !(key in out)) {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return out;
}

/** Attaches req.cookies to every request. */
export function attachCookies(req, res, next) {
  req.cookies = parseCookies(req);
  next();
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    path: '/',
  });
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProduction,
  path: '/',
};

export function setCustomerCookie(res, token) {
  res.cookie(CUSTOMER_COOKIE, token, {
    ...cookieOptions,
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
  });
}

export function clearCustomerCookie(res) {
  res.clearCookie(CUSTOMER_COOKIE, cookieOptions);
}
