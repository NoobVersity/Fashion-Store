/**
 * Minimal server-side validation helper.
 *
 * Usage:
 *   const v = new Validator(req.body);
 *   v.string('name', { label: 'Name', min: 2, max: 120 });
 *   v.int('price', { label: 'Price', min: 0 });
 *   if (!v.ok) return res.status(400).json({ error: 'Validation failed.', details: v.errors });
 *   v.value.name  // trimmed, verified value
 *
 * Every write operation on the server validates through this class,
 * so the browser is never trusted.
 */
export class Validator {
  constructor(body) {
    this.body = body && typeof body === 'object' ? body : {};
    this.errors = {};
    this.value = {};
  }

  get ok() {
    return Object.keys(this.errors).length === 0;
  }

  fail(key, message) {
    this.errors[key] = message;
    return undefined;
  }

  string(key, opts = {}) {
    const {
      label = key,
      required = true,
      min = 0,
      max = 1000,
      trim = true,
      pattern,
      patternMessage,
      allowEmpty = !required,
      defaultValue = '',
    } = opts;

    let raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    if (typeof raw !== 'string') return this.fail(key, `${label} must be text.`);

    const val = trim ? raw.trim() : raw;
    if (!val && !allowEmpty) return this.fail(key, `${label} is required.`);
    if (val.length < min) {
      return this.fail(key, `${label} must be at least ${min} characters.`);
    }
    if (val.length > max) {
      return this.fail(key, `${label} must be at most ${max} characters.`);
    }
    if (pattern && val && !pattern.test(val)) {
      return this.fail(key, patternMessage || `${label} is not valid.`);
    }
    this.value[key] = val;
    return val;
  }

  email(key, opts = {}) {
    return this.string(key, {
      label: 'Email',
      max: 254,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMessage: 'Email must be a valid address.',
      ...opts,
    });
  }

  int(key, opts = {}) {
    const { label = key, required = true, min = -Infinity, max = Infinity, defaultValue = 0 } = opts;
    let raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    // Accept integers or clean numeric strings (form inputs).
    const num = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (typeof num !== 'number' || !Number.isFinite(num) || !Number.isInteger(num)) {
      return this.fail(key, `${label} must be a whole number.`);
    }
    if (num < min) return this.fail(key, `${label} must be at least ${min}.`);
    if (num > max) return this.fail(key, `${label} must be at most ${max}.`);
    this.value[key] = num;
    return num;
  }

  number(key, opts = {}) {
    const { label = key, required = true, min = -Infinity, max = Infinity, defaultValue = 0 } = opts;
    const raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    const num = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (typeof num !== 'number' || !Number.isFinite(num)) {
      return this.fail(key, `${label} must be a number.`);
    }
    if (num < min) return this.fail(key, `${label} must be at least ${min}.`);
    if (num > max) return this.fail(key, `${label} must be at most ${max}.`);
    this.value[key] = num;
    return num;
  }

  bool(key, opts = {}) {
    const { label = key, required = true, defaultValue = true } = opts;
    const raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    if (typeof raw === 'boolean') {
      this.value[key] = raw;
      return raw;
    }
    if (raw === 1 || raw === 0) {
      this.value[key] = Boolean(raw);
      return Boolean(raw);
    }
    if (raw === 'true' || raw === 'false') {
      this.value[key] = raw === 'true';
      return raw === 'true';
    }
    return this.fail(key, `${label} must be true or false.`);
  }

  oneOf(key, options, opts = {}) {
    const { label = key, required = true, defaultValue = options[0] } = opts;
    const raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    if (!options.includes(raw)) {
      return this.fail(key, `${label} must be one of: ${options.join(', ')}.`);
    }
    this.value[key] = raw;
    return raw;
  }

  /** Optional/nullable ISO date string (datetime-local or ISO). */
  isoDate(key, opts = {}) {
    const { label = key, required = false, defaultValue = null } = opts;
    const raw = this.body[key];
    if (raw === undefined || raw === null || raw === '') {
      if (required) return this.fail(key, `${label} is required.`);
      this.value[key] = defaultValue;
      return defaultValue;
    }
    if (typeof raw !== 'string') return this.fail(key, `${label} must be a date.`);
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return this.fail(key, `${label} must be a valid date.`);
    }
    const iso = parsed.toISOString();
    this.value[key] = iso;
    return iso;
  }
}

/** Slug pattern: lowercase letters, digits, single dashes. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
