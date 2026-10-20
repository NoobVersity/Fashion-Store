import { getDb } from '../database/db.js';
import { slugify } from '../validation/validate.js';

/** Returns a slug that is unique in the products/categories table. */
export function ensureUniqueSlug(table, base, excludeId = null) {
  const db = getDb();
  const root = slugify(base) || 'item';
  let candidate = root;
  let n = 1;
  for (;;) {
    const row = excludeId
      ? db
          .prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
          .get(candidate, excludeId)
      : db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(candidate);
    if (!row) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}
