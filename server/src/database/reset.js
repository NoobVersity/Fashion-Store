import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { closeDb } from './db.js';
import { seedDatabase } from './seed.js';

/**
 * Drops the local demo database and recreates it from schema + seed.
 * Destructive by design — local development only.
 */
export function resetDatabase() {
  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const file = `${config.dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
  seedDatabase();
}

// CLI: npm run db:reset
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(`Resetting database at ${config.dbPath}`);
    resetDatabase();
  } catch (err) {
    console.error(`Reset failed: ${err.message}`);
    process.exit(1);
  }
}
