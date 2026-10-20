import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const serverRoot = path.resolve(__dirname, '..');
export const repoRoot = path.resolve(serverRoot, '..');

/**
 * Minimal .env loader (no third-party dependency).
 * Values already present in process.env are never overwritten.
 */
function loadEnvFile() {
  const envPath = path.join(serverRoot, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const DEFAULT_DEV_SECRET = 'threads-local-development-secret-do-not-use-in-production';

function resolveSessionSecret() {
  const raw = process.env.SESSION_SECRET;
  const isPlaceholder = !raw || raw === 'replace-with-a-long-random-string';
  if (isProduction && (isPlaceholder || raw.length < 16)) {
    throw new Error(
      'SESSION_SECRET must be set to a long random value when NODE_ENV=production.'
    );
  }
  return isPlaceholder ? DEFAULT_DEV_SECRET : raw;
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv,
  isProduction,
  sessionSecret: resolveSessionSecret(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS) || 8,
  dbPath:
    process.env.DATABASE_PATH ||
    path.join(serverRoot, 'data', 'threads.sqlite'),
  clientDist: path.resolve(repoRoot, 'client', 'dist'),
  // Login rate limiting (failures per key per window).
  loginWindowMs: Number(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000,
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS) || 10,
};
