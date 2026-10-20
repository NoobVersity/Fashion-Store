import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, checkoutPayload } from './helpers.js';

/**
 * Admin management behavior: CRUD, validation, order lifecycle
 * (including single stock restoration on cancel) and settings.
 */

const ctx = await createTestContext();
test.after(() => ctx.close());

await ctx.client.login(); // this file's tests all act as an admin

test('creating a product validates input and auto-generates a slug', async () => {
  const bad = await ctx.client.post('/api/admin/products', {
    name: 'X',
    price: -5,
    category_id: 1,
    image_path: 'javascript:alert(1)',
    is_active: true,
    variants: [],
  });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.details.name);
  assert.ok(bad.data.details.price);
  assert.ok(bad.data.details.image_path);
  assert.ok(bad.data.details.variants);

  const good = await ctx.client.post('/api/admin/products', {
    name: 'Linen Oversized Shirt',
    description: 'Nice and airy.',
    price: 5999,
    category_id: 1,
    image_path: '/images/products/linen-oversized-shirt.svg',
    is_active: true,
    variants: [
      { size: 'M', color: 'Sand', stock_quantity: 4 },
      { size: 'L', color: 'Sand', stock_quantity: 2 },
    ],
  });
  assert.equal(good.status, 201);
  assert.equal(good.data.product.slug, 'linen-oversized-shirt');
  assert.equal(good.data.product.total_stock, 6);
  assert.equal(good.data.product.variants.length, 2);
});

test('duplicate slugs are rejected', async () => {
  const res = await ctx.client.post('/api/admin/products', {
    name: 'Linen Oversized Shirt Copy',
    slug: 'linen-oversized-shirt',
    description: '',
    price: 1000,
    category_id: 1,
    image_path: '/images/x.svg',
    is_active: true,
    variants: [{ size: 'M', color: 'Sand', stock_quantity: 1 }],
  });
  assert.equal(res.status, 409);
});

test('product updates persist and can toggle status', async () => {
  const created = await ctx.client.post('/api/admin/products', {
    name: 'Update Me Jacket',
    description: 'v1',
    price: 8000,
    category_id: 1,
    image_path: '/images/x.svg',
    is_active: true,
    variants: [{ size: 'M', color: 'Black', stock_quantity: 3 }],
  });
  const id = created.data.product.id;

  const updated = await ctx.client.put(`/api/admin/products/${id}`, {
    name: 'Update Me Jacket',
    description: 'v2',
    price: 7500,
    category_id: 1,
    image_path: '/images/x.svg',
    is_active: true,
    variants: [{ size: 'M', color: 'Black', stock_quantity: 9 }],
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.product.description, 'v2');
  assert.equal(updated.data.product.price, 7500);
  assert.equal(updated.data.product.variants[0].stock_quantity, 9);

  const toggled = await ctx.client.patch(`/api/admin/products/${id}/status`, {
    is_active: false,
  });
  assert.equal(toggled.data.product.is_active, false);

  // Inactive products disappear from the public catalog.
  const publicList = await ctx.client.get('/api/products?limit=48');
  assert.ok(!publicList.data.items.some((p) => p.id === id));
});

test('products referenced by orders cannot be deleted', async () => {
  // Place an order for the main product first.
  const order = await ctx.client.post('/api/checkout', checkoutPayload());
  assert.equal(order.status, 201);

  const res = await ctx.client.del('/api/admin/products/1');
  assert.equal(res.status, 409);
  assert.match(res.data.error, /order history/i);
});

test('categories enforce unique names and protect product references', async () => {
  const dup = await ctx.client.post('/api/admin/categories', {
    name: 'TOPS', // same as seeded 'Tops' (case-insensitive)
    description: '',
    is_active: true,
  });
  assert.equal(dup.status, 409);

  const withProducts = await ctx.client.del('/api/admin/categories/1');
  assert.equal(withProducts.status, 409);
  assert.match(withProducts.error || withProducts.data.error, /product/i);

  const created = await ctx.client.post('/api/admin/categories', {
    name: 'Shoes',
    description: 'Footwear.',
    is_active: true,
  });
  assert.equal(created.status, 201);
  const empty = await ctx.client.del(`/api/admin/categories/${created.data.category.id}`);
  assert.equal(empty.status, 204);
});

test('order status transitions follow the rules', async () => {
  const list = await ctx.client.get('/api/admin/orders');
  const orderId = list.data.items.find((o) => o.order_status === 'pending').id;

  const bad = await ctx.client.patch(`/api/admin/orders/${orderId}/status`, {
    status: 'shipped',
  });
  assert.equal(bad.status, 409);
  assert.ok(Array.isArray(bad.data.allowed));
  assert.ok(bad.data.allowed.includes('processing'));

  const good = await ctx.client.patch(`/api/admin/orders/${orderId}/status`, {
    status: 'processing',
  });
  assert.equal(good.status, 200);
  assert.equal(good.data.order.order_status, 'processing');

  const invalid = await ctx.client.patch(`/api/admin/orders/${orderId}/status`, {
    status: 'sideways',
  });
  assert.equal(invalid.status, 400);
});

test('cancelling an order restores stock exactly once', async () => {
  const stockBefore = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;

  const order = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ items: [{ productId: 1, size: 'M', color: 'Black', quantity: 4 }] })
  );
  assert.equal(order.status, 201);
  const orderId = order.data.order.id;

  const stockDeducted = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;
  assert.equal(stockDeducted, stockBefore - 4);

  const cancel = await ctx.client.patch(`/api/admin/orders/${orderId}/status`, {
    status: 'cancelled',
  });
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.order.order_status, 'cancelled');

  const stockRestored = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;
  assert.equal(stockRestored, stockBefore, 'stock restored after cancel');

  // Cancelled is terminal — a second cancel is impossible, so stock
  // cannot be restored twice.
  const again = await ctx.client.patch(`/api/admin/orders/${orderId}/status`, {
    status: 'cancelled',
  });
  assert.equal(again.status, 409);
  const stockFinal = ctx.db
    .prepare("SELECT stock_quantity FROM product_variants WHERE product_id = 1 AND size = 'M'")
    .get().stock_quantity;
  assert.equal(stockFinal, stockBefore);
});

test('discount usage is capped by the usage limit', async () => {
  await ctx.client.post('/api/admin/discounts', {
    code: 'ONCEONLY',
    discount_type: 'fixed',
    discount_value: 100,
    minimum_order_value: 0,
    usage_limit: 1,
    is_active: true,
    description: '',
  });

  const first = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ discount_code: 'ONCEONLY' })
  );
  assert.equal(first.status, 201);
  assert.equal(first.data.order.discount_amount, 100);

  const second = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({ discount_code: 'ONCEONLY' })
  );
  assert.equal(second.status, 400);
  assert.match(second.data.error, /usage limit/i);
});

test('inventory stock can be updated but never made negative', async () => {
  const list = await ctx.client.get('/api/admin/inventory');
  assert.equal(list.status, 200);
  const variantId = list.data.items[0].variant_id;

  const good = await ctx.client.patch(`/api/admin/inventory/${variantId}`, {
    stock_quantity: 25,
  });
  assert.equal(good.status, 200);
  assert.equal(good.data.variant.stock_quantity, 25);

  const negative = await ctx.client.patch(`/api/admin/inventory/${variantId}`, {
    stock_quantity: -5,
  });
  assert.equal(negative.status, 400);
});

test('store settings validate and persist', async () => {
  const current = await ctx.client.get('/api/admin/settings');
  const settings = current.data.settings;

  const updated = await ctx.client.put('/api/admin/settings', {
    ...settings,
    store_name: 'THREADS Test Lab',
    low_stock_threshold: 9,
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.settings.store_name, 'THREADS Test Lab');

  // Persisted: the public endpoint reflects it.
  const publicSettings = await ctx.client.get('/api/store-settings/public');
  assert.equal(publicSettings.data.store_name, 'THREADS Test Lab');
  assert.equal(publicSettings.data.low_stock_threshold, '9');

  const invalid = await ctx.client.put('/api/admin/settings', {
    ...settings,
    contact_email: 'not-a-valid-email',
  });
  assert.equal(invalid.status, 400);
  assert.ok(invalid.data.details.contact_email);

  await ctx.client.put('/api/admin/settings', { ...settings });
});

test('dashboard stats reflect database content', async () => {
  const res = await ctx.client.get('/api/admin/dashboard/stats');
  assert.equal(res.status, 200);
  const { stats } = res.data;
  assert.ok(stats.totalOrders >= 2);
  assert.ok(stats.totalProducts >= 2);
  assert.ok(stats.revenue30d >= 0);
  assert.ok(Array.isArray(stats.recentOrders));
  assert.ok(stats.recentOrders.length >= 1);
});
