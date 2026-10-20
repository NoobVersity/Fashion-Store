import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, checkoutPayload } from './helpers.js';

/**
 * Checkout tests: the server is authoritative for prices, stock and
 * discounts; totals are computed server-side; duplicate submissions
 * cannot create duplicate orders.
 */

const ctx = await createTestContext();
test.after(() => ctx.close());

test('checkout computes totals from database prices', async () => {
  const res = await ctx.client.post('/api/checkout', checkoutPayload());
  assert.equal(res.status, 201);
  const order = res.data.order;

  // 2 × $25.00 — the browser sent no price at all.
  assert.equal(order.subtotal, 5000);
  assert.equal(order.discount_amount, 0);
  assert.equal(order.total, 5000);
  assert.equal(order.order_status, 'pending');
  assert.equal(order.payment_method, 'simulated');
  assert.match(order.order_number, /^TH-\d{6}$/);
  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].unit_price, 2500);
  assert.equal(order.items[0].product_name_snapshot, 'Test Tee');
  assert.equal(order.items[0].variant_snapshot, 'M / Black');
  assert.equal(order.items[0].line_total, 5000);
});

test('stock is reduced by the purchased quantity', async () => {
  const before = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;

  const res = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ items: [{ productId: 1, size: 'M', color: 'Black', quantity: 3 }] })
  );
  assert.equal(res.status, 201);

  const after = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;
  assert.equal(after, before - 3);
});

test('valid discount is applied, invalid and expired are rejected', async () => {
  const withDiscount = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ discount_code: 'TEST10' })
  );
  assert.equal(withDiscount.status, 201);
  assert.equal(withDiscount.data.order.subtotal, 5000);
  assert.equal(withDiscount.data.order.discount_amount, 500); // 10%
  assert.equal(withDiscount.data.order.total, 4500);
  assert.equal(withDiscount.data.order.discount_code, 'TEST10');

  const expired = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ discount_code: 'OLD20' })
  );
  assert.equal(expired.status, 400);
  assert.match(expired.data.error, /expired/i);

  const unknown = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ discount_code: 'NOPE' })
  );
  assert.equal(unknown.status, 400);
});

test('ordering more than available stock is rejected without side effects', async () => {
  const stockBefore = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'S'")
    .get().stock_quantity; // 2

  const res = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ items: [{ productId: 1, size: 'S', color: 'Black', quantity: 99 }] })
  );
  assert.equal(res.status, 409);
  assert.match(res.data.error, /not enough stock/i);
  assert.equal(res.data.available, stockBefore);

  const stockAfter = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'S'")
    .get().stock_quantity;
  assert.equal(stockAfter, stockBefore, 'stock must be unchanged after a failed order');
});

test('out-of-stock variants cannot be ordered', async () => {
  const res = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ items: [{ productId: 1, size: 'XS', color: 'Black', quantity: 1 }] })
  );
  assert.equal(res.status, 409);
});

test('inactive products cannot be ordered', async () => {
  ctx.db.prepare('UPDATE products SET is_active = 0 WHERE id = 1').run();
  const res = await ctx.client.post('/api/checkout', checkoutPayload());
  assert.equal(res.status, 400);
  assert.match(res.data.error, /no longer available/i);
  ctx.db.prepare('UPDATE products SET is_active = 1 WHERE id = 1').run();
});

test('duplicate checkout tokens create exactly one order', async () => {
  const payload = checkoutPayload({
    items: [{ productId: 1, size: 'M', color: 'Black', quantity: 1 }],
  });
  const first = await ctx.client.post('/api/checkout', payload);
  assert.equal(first.status, 201);

  const ordersBefore = ctx.db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE checkout_token = ?")
    .get(payload.checkout_token).c;

  const second = await ctx.client.post('/api/checkout', payload);
  assert.equal(second.status, 409);
  assert.equal(second.data.duplicate, true);
  assert.equal(second.data.order.order_number, first.data.order.order_number);

  const ordersAfter = ctx.db
    .prepare("SELECT COUNT(*) AS c FROM orders WHERE checkout_token = ?")
    .get(payload.checkout_token).c;
  assert.equal(ordersAfter, ordersBefore);
});

test('checkout validates required customer fields', async () => {
  const res = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({
      customer: { name: '', email: 'not-an-email', phone: '' },
      shipping_address: '',
    })
  );
  assert.equal(res.status, 400);
  assert.ok(res.data.details.name);
  assert.ok(res.data.details.email);
  assert.ok(res.data.details.shipping_address);
});

test('created orders appear in the admin order list', async () => {
  await ctx.client.login();
  const res = await ctx.client.get('/api/admin/orders');
  assert.equal(res.status, 200);
  assert.ok(res.data.items.length >= 1);
  assert.ok(res.data.items.every((o) => typeof o.total === 'number'));
});
