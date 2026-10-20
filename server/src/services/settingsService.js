import { getDb } from '../database/db.js';

/**
 * Store settings are simple key/value rows. Missing keys fall back to
 * the defaults below so the storefront always renders.
 */
export const DEFAULT_SETTINGS = {
  store_name: 'THREADS',
  contact_email: 'hello@threads.store',
  contact_phone: '+1 (555) 010-2040',
  currency: 'USD',
  currency_symbol: '$',
  low_stock_threshold: '5',
  store_description:
    'Modern clothing and accessories, curated in small runs. Clean silhouettes, honest fabrics.',
};

/** Keys that are safe to expose on the public storefront. */
export const PUBLIC_SETTING_KEYS = [
  'store_name',
  'contact_email',
  'contact_phone',
  'currency',
  'currency_symbol',
  'store_description',
  'low_stock_threshold',
];

export function getAllSettings() {
  const rows = getDb().prepare('SELECT key, value FROM store_settings').all();
  const settings = { ...DEFAULT_SETTINGS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

export function getPublicSettings() {
  const all = getAllSettings();
  const out = {};
  for (const key of PUBLIC_SETTING_KEYS) out[key] = all[key];
  return out;
}

/** Upserts the given { key: value } entries atomically. */
export function saveSettings(entries) {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO store_settings (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const run = db.transaction((pairs) => {
    for (const [key, value] of pairs) stmt.run(key, String(value));
  });
  run(Object.entries(entries));
}

export function getLowStockThreshold() {
  const raw = getAllSettings().low_stock_threshold;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 ? n : 5;
}
