import { createApp } from './app.js';
import { config } from './config.js';
import { cleanupExpiredSessions } from './services/sessionService.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`THREADS API listening on http://localhost:${config.port}`);
  if (!config.isProduction) {
    console.log('  Public API:  http://localhost:' + config.port + '/api/products');
    console.log('  Admin API:   http://localhost:' + config.port + '/api/admin/… (session protected)');
  }
});

// Hourly cleanup of expired admin sessions.
setInterval(cleanupExpiredSessions, 60 * 60 * 1000).unref();
