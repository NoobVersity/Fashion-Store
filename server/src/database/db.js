import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { createSchema } from './schema.js';

let db = null;

/**
 * Lazily open the SQLite connection (foreign keys enforced) and make
 * sure the schema exists. Tests set DATABASE_PATH before first use,
 * which is why opening is deferred instead of happening at import time.
 */
export function getDb() {
  if (!db) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    createSchema(db);
  }
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
