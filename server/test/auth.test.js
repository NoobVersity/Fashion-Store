import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext, checkoutPayload } from './helpers.js';

/**
 * Customer accounts: register (incl. claiming a guest email), login,
 * profile updates, order history, logout and rate limiting.
 */

const ctx = await createTestContext();
test.after(() => ctx.close());

test('register validates input', async () => {
  const res = await ctx.client.post('/api/auth/register', {
    name: 'A',
    email: 'nope',
    password: 'short',
  });
  assert.equal(res.status, 400);
  assert.ok(res.data.details.name);
  assert.ok(res.data.details.email);
  assert.ok(res.data.details.password);
});

test('register creates an account and signs the customer in', async () => {
  const res = await ctx.client.post('/api/auth/register', {
    name: 'Cara Devon',
    email: 'cara@test.local',
    password: 'super secret 1',
  });
  assert.equal(res.status, 201);
  assert.equal(res.data.customer.email, 'cara@test.local');
  assert.ok(!res.data.customer.password_hash); // never serialized

  const me = await ctx.client.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.customer.name, 'Cara Devon');
});

test('duplicate registration returns 409', async () => {
  const res = await ctx.client.post('/api/auth/register', {
    name: 'Cara Devon',
    email: 'cara@test.local',
    password: 'super secret 1',
  });
  assert.equal(res.status, 409);
});

test('login rejects wrong passwords and accepts the right one', async () => {
  const wrong = await ctx.client.post('/api/auth/login', {
    email: 'cara@test.local',
    password: 'not the one',
  });
  assert.equal(wrong.status, 401);

  const ok = await ctx.client.post('/api/auth/login', {
    email: 'cara@test.local',
    password: 'super secret 1',
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.customer.email, 'cara@test.local');
});

test('profile details can be updated', async () => {
  const res = await ctx.client.patch('/api/auth/me', {
    name: 'Cara D.',
    phone: '555-0111',
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.customer.name, 'Cara D.');

  const me = await ctx.client.get('/api/auth/me');
  assert.equal(me.data.customer.phone, '555-0111');
});

test('orders placed while signed in appear in the history', async () => {
  const order = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({
      customer: { name: 'Cara D.', email: 'cara@test.local', phone: '555-0111' },
    })
  );
  assert.equal(order.status, 201);

  const history = await ctx.client.get('/api/auth/orders');
  assert.equal(history.status, 200);
  assert.equal(history.data.pagination.total, 1);
  assert.equal(history.data.items[0].items.length, 1);
  assert.equal(history.data.items[0].items[0].name, 'Test Tee');
});

test('a guest can claim their email and keeps their order history', async () => {
  await ctx.client.post('/api/auth/logout');

  const guestOrder = await ctx.client.post(
    '/api/checkout',
    checkoutPayload({
      customer: { name: 'Guest Twin', email: 'twin@test.local', phone: '' },
    })
  );
  assert.equal(guestOrder.status, 201);

  const reg = await ctx.client.post('/api/auth/register', {
    name: 'Guest Twin',
    email: 'twin@test.local',
    password: 'another secret',
  });
  assert.equal(reg.status, 201);

  const history = await ctx.client.get('/api/auth/orders');
  assert.equal(history.data.pagination.total, 1); // the guest order came along
});

test('logout ends the session', async () => {
  const out = await ctx.client.post('/api/auth/logout'); // signed in as twin
  assert.equal(out.status, 204);
  assert.equal((await ctx.client.get('/api/auth/me')).status, 401);
});

test('customer endpoints require a session', async () => {
  // Still signed out from the previous test.
  assert.equal((await ctx.client.get('/api/auth/me')).status, 401);
  assert.equal((await ctx.client.get('/api/auth/orders')).status, 401);
  assert.equal(
    (await ctx.client.patch('/api/auth/me', { name: 'Nope' })).status,
    401
  );
});

test('customer login attempts are rate limited', async () => {
  // LOGIN_MAX_ATTEMPTS defaults to 10 (per email+IP); the successful
  // sign-in earlier reset this key, so failures start from zero.
  for (let i = 0; i < 10; i += 1) {
    const res = await ctx.client.post('/api/auth/login', {
      email: 'cara@test.local',
      password: 'guess',
    });
    assert.equal(res.status, 401);
  }
  const blocked = await ctx.client.post('/api/auth/login', {
    email: 'cara@test.local',
    password: 'guess',
  });
  assert.equal(blocked.status, 429);
});
