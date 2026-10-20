import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';

/**
 * Test bootstrap: each test file gets its own temporary SQLite database
 * and its own server instance on an ephemeral port.
 *
 * Environment variables must be set BEFORE the app modules are
 * imported, so everything below uses dynamic imports.
 */
export async function createTestContext({ loginMaxAttempts } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-test-'));
  process.env.DATABASE_PATH = path.join(dir, 'test.sqlite');
  process.env.NODE_ENV = 'test';
  process.env.SESSION_SECRET = 'test-session-secret-1234567890abcdef';
  if (loginMaxAttempts) process.env.LOGIN_MAX_ATTEMPTS = String(loginMaxAttempts);

  const { createApp } = await import('../src/app.js');
  const { getDb } = await import('../src/database/db.js');
  const { hashPassword } = await import('../src/services/passwordService.js');

  const db = getDb();

  // -- minimal fixtures ------------------------------------------------
  db.prepare('INSERT INTO admins (email, password_hash) VALUES (?, ?)').run(
    'admin@test.local',
    hashPassword('correct horse battery')
  );
  db.prepare(
    'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)'
  ).run('Tops', 'tops', 'Shirts and tees.');

  const productInfo = db
    .prepare(
      `INSERT INTO products (category_id, name, slug, description, price, image_path, is_active)
       VALUES (1, 'Test Tee', 'test-tee', 'A test t-shirt.', 2500, '/images/products/test-tee.svg', 1)`
    )
    .run();
  const productId = Number(productInfo.lastInsertRowid);
  const insertVariant = db.prepare(
    'INSERT INTO product_variants (product_id, size, color, stock_quantity) VALUES (?, ?, ?, ?)'
  );
  insertVariant.run(productId, 'M', 'Black', 10);
  insertVariant.run(productId, 'S', 'Black', 2);
  insertVariant.run(productId, 'XS', 'Black', 0); // out of stock on purpose

  db.prepare(
    `INSERT INTO discounts (code, discount_type, discount_value, minimum_order_value, is_active)
     VALUES ('TEST10', 'percentage', 10, 0, 1)`
  ).run();
  db.prepare(
    `INSERT INTO discounts (code, discount_type, discount_value, expires_at, is_active)
     VALUES ('OLD20', 'percentage', 20, '2020-01-01T00:00:00.000Z', 1)`
  ).run();

  // -- HTTP client with a tiny cookie jar --------------------------------
  let cookie = '';
  async function request(method, urlPath, body) {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie') || '';
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    return {
      status: res.status,
      data: text ? JSON.parse(text) : null,
      headers: res.headers,
    };
  }

  const server = createApp().listen(0);
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const client = {
    get: (p) => request('GET', p),
    post: (p, body) => request('POST', p, body),
    put: (p, body) => request('PUT', p, body),
    patch: (p, body) => request('PATCH', p, body),
    del: (p) => request('DELETE', p),
    async login(email = 'admin@test.local', password = 'correct horse battery') {
      return request('POST', '/api/admin/auth/login', { email, password });
    },
    async logout() {
      return request('POST', '/api/admin/auth/logout');
    },
  };

  return {
    client,
    db,
    productId,
    async close() {
      server.close();
      await new Promise((resolve) => setTimeout(resolve, 20));
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort cleanup on Windows */
      }
    },
  };
}

/** Convenience: place a checkout order and return the response. */
export function checkoutPayload(overrides = {}) {
  return {
    items: [{ productId: 1, size: 'M', color: 'Black', quantity: 2 }],
    customer: { name: 'Test Customer', email: 'customer@test.local', phone: '555-0100' },
    shipping_address: '1 Test Street, Testville',
    order_note: '',
    discount_code: '',
    checkout_token: `tok-${Math.random().toString(36).slice(2)}${Date.now()}`,
    ...overrides,
  };
}
