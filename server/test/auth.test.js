import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestContext } from './helpers.js';

/**
 * Admin authentication + authorization tests:
 * generic errors, session cookies, logout, password change and login
 * rate limiting.
 */

// Failures accumulate per email+IP; the rate-limit test runs last.
const ctx = await createTestContext({ loginMaxAttempts: 5 });
test.after(() => ctx.close());

test('login success sets an HTTP-only session cookie', async () => {
  const res = await ctx.client.login();
  assert.equal(res.status, 200);
  assert.equal(res.data.admin.email, 'admin@test.local');
  const raw = res.headers.get('set-cookie') || '';
  assert.match(raw, /threads_session=/);
  assert.match(raw, /HttpOnly/i);
  assert.match(raw, /SameSite=Lax/i);
});

test('protected admin endpoint works with a valid session', async () => {
  await ctx.client.login();
  const res = await ctx.client.get('/api/admin/auth/me');
  assert.equal(res.status, 200);
  assert.equal(res.data.admin.email, 'admin@test.local');
});

test('wrong password returns a generic 401', async () => {
  const res = await ctx.client.login('admin@test.local', 'not the password');
  assert.equal(res.status, 401);
  assert.equal(res.data.error, 'Invalid email or password.');
});

test('unknown email returns the same generic 401', async () => {
  const res = await ctx.client.login('nobody@test.local', 'whatever123');
  assert.equal(res.status, 401);
  assert.equal(res.data.error, 'Invalid email or password.');
});

test('admin endpoints reject unauthenticated requests', async () => {
  await ctx.client.logout(); // drop any session from earlier tests
  for (const path of [
    '/api/admin/products',
    '/api/admin/orders',
    '/api/admin/settings',
    '/api/admin/customers',
    '/api/admin/discounts',
    '/api/admin/inventory',
    '/api/admin/dashboard/stats',
    '/api/admin/categories',
  ]) {
    const res = await ctx.client.get(path);
    assert.equal(res.status, 401, `${path} must require auth`);
  }
});

test('logout destroys the session server-side', async () => {
  await ctx.client.login();
  const out = await ctx.client.logout();
  assert.equal(out.status, 204);
  const res = await ctx.client.get('/api/admin/auth/me');
  assert.equal(res.status, 401);
});

test('change-password verifies the current password', async () => {
  await ctx.client.login();
  const bad = await ctx.client.post('/api/admin/auth/change-password', {
    currentPassword: 'wrong',
    newPassword: 'a brand new secret',
  });
  assert.equal(bad.status, 401);

  const good = await ctx.client.post('/api/admin/auth/change-password', {
    currentPassword: 'correct horse battery',
    newPassword: 'a brand new secret',
  });
  assert.equal(good.status, 200);

  // The session was rotated: old cookie no longer valid… the client
  // captured the new cookie automatically, so the new one must work.
  const me = await ctx.client.get('/api/admin/auth/me');
  assert.equal(me.status, 200);

  // And the new password now signs in.
  const relogin = await ctx.client.login('admin@test.local', 'a brand new secret');
  assert.equal(relogin.status, 200);

  // Weak new passwords are rejected.
  const weak = await ctx.client.post('/api/admin/auth/change-password', {
    currentPassword: 'a brand new secret',
    newPassword: 'short',
  });
  assert.equal(weak.status, 400);
  assert.ok(weak.data.details.newPassword);
});

test('login is rate limited after repeated failures', async () => {
  let last;
  for (let i = 0; i < 6; i += 1) {
    last = await ctx.client.login('admin@test.local', 'still wrong');
  }
  assert.equal(last.status, 429);
  assert.match(last.data.error, /Too many login attempts/i);
});
