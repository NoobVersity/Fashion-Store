import { getDb } from './db.js';
import { createSchema } from './schema.js';

/**
 * Repeatable database initialization: creates every table if missing.
 * Safe to run any number of times.
 */
export function initDatabase() {
  const db = getDb();
  createSchema(db);
  return db;
}

// CLI: npm run db:init
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  initDatabase();
  console.log('Database initialized.');
}
