import { config } from '../config.js';

/** Small structured error with an HTTP status. */
export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Wraps async route handlers so rejections reach the error handler. */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFound(req, res) {
  res.status(404).json({ error: 'Not found.' });
}

/* eslint-disable no-unused-vars */
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return;

  // Body parser failures
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }

  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status >= 500) {
    console.error('[threads] Unhandled error:', err);
  }
  const payload = {
    error:
      status >= 500
        ? 'Internal server error.'
        : err.message || 'Request failed.',
  };
  if (err.details) payload.details = err.details;
  return res.status(status).json(payload);
}
