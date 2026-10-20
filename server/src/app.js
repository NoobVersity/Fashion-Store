import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import { attachCookies } from './middleware/cookies.js';
import { securityHeaders, originCheck } from './middleware/security.js';
import { requireAdmin } from './middleware/requireAdmin.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

import productsRouter from './routes/products.js';
import categoriesRouter from './routes/categories.js';
import discountsRouter from './routes/discounts.js';
import checkoutRouter from './routes/checkout.js';
import storeSettingsRouter from './routes/storeSettings.js';
import authRouter from './routes/auth.js';

import adminAuthRouter from './routes/admin/auth.js';
import adminProductsRouter from './routes/admin/products.js';
import adminCategoriesRouter from './routes/admin/categories.js';
import adminOrdersRouter from './routes/admin/orders.js';
import adminCustomersRouter from './routes/admin/customers.js';
import adminDiscountsRouter from './routes/admin/discounts.js';
import adminInventoryRouter from './routes/admin/inventory.js';
import adminSettingsRouter from './routes/admin/settings.js';
import adminDashboardRouter from './routes/admin/dashboard.js';

/**
 * Express application factory.
 * In development Vite proxies /api here (single origin). In production
 * Express also serves the built client, keeping everything same-origin
 * so HTTP-only session cookies work without CORS.
 */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(express.json({ limit: '100kb' }));
  app.use(attachCookies);

  // ---------------------------------------------------- public API
  app.use('/api/products', productsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/discounts', discountsRouter);
  app.use('/api/checkout', checkoutRouter);
  app.use('/api/store-settings', storeSettingsRouter);
  app.use('/api/auth', authRouter);

  // ---------------------------------------------------- admin API
  // Every admin endpoint is authenticated on the server, and every
  // state-changing one passes an origin (CSRF) check first.
  app.use('/api/admin', originCheck);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin/products', requireAdmin, adminProductsRouter);
  app.use('/api/admin/categories', requireAdmin, adminCategoriesRouter);
  app.use('/api/admin/orders', requireAdmin, adminOrdersRouter);
  app.use('/api/admin/customers', requireAdmin, adminCustomersRouter);
  app.use('/api/admin/discounts', requireAdmin, adminDiscountsRouter);
  app.use('/api/admin/inventory', requireAdmin, adminInventoryRouter);
  app.use('/api/admin/settings', requireAdmin, adminSettingsRouter);
  app.use('/api/admin/dashboard', requireAdmin, adminDashboardRouter);

  // Unknown API routes → JSON 404 (never the SPA page).
  app.use('/api', notFound);

  // ---------------------------------------------------- static client
  const indexHtml = path.join(config.clientDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    app.use(express.static(config.clientDist, { index: false }));
    // SPA fallback for non-API GET routes (/admin, /catalog, ...).
    app.get(/^\/(?!api\/).*/, (req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(indexHtml);
    });
  }

  app.use(errorHandler);
  return app;
}
