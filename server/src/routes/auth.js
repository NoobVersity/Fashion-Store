import express from 'express';
import { getDb } from '../database/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { originCheck } from '../middleware/security.js';
import { customerLoginLimiter } from '../middleware/rateLimit.js';
import {
  CUSTOMER_COOKIE,
  setCustomerCookie,
  clearCustomerCookie,
} from '../middleware/cookies.js';
import {
  createCustomerSession,
  resolveCustomerSession,
  destroyCustomerSession,
} from '../services/customerSessionService.js';
import {
  hashPassword,
  verifyPassword,
} from '../services/passwordService.js';
import { Validator } from '../validation/validate.js';

const router = express.Router();
// Cookie-setting + write endpoints get the same CSRF origin check as admin.
router.use(originCheck);

const publicCustomer = (c) => ({
  id: c.id,
  name: c.name,
  email: c.email,
  phone: c.phone,
});

function requireCustomer(req, res, next) {
  const token = req.cookies ? req.cookies[CUSTOMER_COOKIE] : undefined;
  const session = resolveCustomerSession(token);
  if (!session) return res.status(401).json({ error: 'Sign in required.' });
  req.customer = session;
  req.customerToken = token;
  return next();
}

/**
 * POST /api/auth/register — creates (or claims) an account. A guest
 * who checked out with this email before keeps their order history;
 * only the contact fields and the new password hash are written.
 */
router.post(
  '/register',
  customerLoginLimiter,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.string('name', { label: 'Name', min: 2, max: 120 });
    v.email('email');
    v.string('password', { label: 'Password', min: 8, max: 200 });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const db = getDb();
    const email = v.value.email.toLowerCase();
    const existing = db
      .prepare('SELECT id, password_hash FROM customers WHERE email = ? COLLATE NOCASE')
      .get(email);

    if (existing && existing.password_hash) {
      return res.status(409).json({
        error: 'An account with this email already exists — try signing in.',
      });
    }

    if (existing) {
      db.prepare(
        `UPDATE customers
            SET name = ?, password_hash = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`
      ).run(v.value.name, hashPassword(v.value.password), existing.id);
    } else {
      db.prepare(
        'INSERT INTO customers (name, email, password_hash) VALUES (?, ?, ?)'
      ).run(v.value.name, email, hashPassword(v.value.password));
    }

    const customer = db
      .prepare('SELECT id, name, email, phone FROM customers WHERE email = ? COLLATE NOCASE')
      .get(email);
    setCustomerCookie(res, createCustomerSession(customer.id));
    return res.status(201).json({ customer: publicCustomer(customer) });
  })
);

/**
 * POST /api/auth/login — rate-limited with a generic error message
 * (never reveals whether an email has an account).
 */
router.post(
  '/login',
  customerLoginLimiter,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.email('email');
    v.string('password', { label: 'Password', max: 200 });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const customer = getDb()
      .prepare('SELECT * FROM customers WHERE email = ? COLLATE NOCASE')
      .get(v.value.email);
    if (
      !customer ||
      !customer.password_hash ||
      !verifyPassword(v.value.password, customer.password_hash)
    ) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    customerLoginLimiter.resetKey(req);
    setCustomerCookie(res, createCustomerSession(customer.id));
    return res.json({ customer: publicCustomer(customer) });
  })
);

/** POST /api/auth/logout */
router.post('/logout', (req, res) => {
  destroyCustomerSession(req.cookies ? req.cookies[CUSTOMER_COOKIE] : undefined);
  clearCustomerCookie(res);
  res.status(204).end();
});

/** GET /api/auth/me */
router.get('/me', requireCustomer, (req, res) => {
  res.json({ customer: req.customer });
});

/** PATCH /api/auth/me — update contact details. */
router.patch(
  '/me',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.string('name', { label: 'Name', min: 2, max: 120 });
    v.string('phone', { label: 'Phone number', max: 40, required: false });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    getDb()
      .prepare(
        `UPDATE customers
            SET name = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`
      )
      .run(v.value.name, v.value.phone, req.customer.id);

    const customer = getDb()
      .prepare('SELECT id, name, email, phone FROM customers WHERE id = ?')
      .get(req.customer.id);
    return res.json({ customer });
  })
);

/** GET /api/auth/orders — order history for the signed-in customer. */
router.get(
  '/orders',
  requireCustomer,
  asyncHandler(async (req, res) => {
    const db = getDb();
    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 10;
    limit = Math.min(limit, 50);

    const { total } = db
      .prepare('SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?')
      .get(req.customer.id);
    const rows = db
      .prepare(
        `SELECT * FROM orders
          WHERE customer_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?`
      )
      .all(req.customer.id, limit, (page - 1) * limit);

    const itemStmt = db.prepare(
      `SELECT product_name_snapshot AS name, variant_snapshot AS variant,
              unit_price, quantity, line_total
         FROM order_items WHERE order_id = ?`
    );
    return res.json({
      items: rows.map((o) => ({
        order_number: o.order_number,
        order_status: o.order_status,
        subtotal: o.subtotal,
        discount_amount: o.discount_amount,
        discount_code: o.discount_code,
        total: o.total,
        shipping_address: o.shipping_address,
        created_at: o.created_at,
        items: itemStmt.all(o.id),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

export default router;
