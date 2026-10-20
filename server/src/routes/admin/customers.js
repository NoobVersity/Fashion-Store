import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator } from '../../validation/validate.js';

const router = express.Router();

/**
 * Customer records are upserted from guest checkouts (one row per
 * email). No passwords exist here — customers never register in the
 * MVP — and only contact data needed for fulfillment is stored.
 */

function customerRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    order_count: row.order_count ?? undefined,
    total_spent: row.total_spent ?? undefined,
    last_order_at: row.last_order_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** GET /api/admin/customers — search by name or email. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDb();
    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 15;
    limit = Math.min(limit, 100);

    const params = [];
    let where = '';
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      where = "WHERE (cu.name LIKE ? ESCAPE '\\' OR cu.email LIKE ? ESCAPE '\\')";
      params.push(like, like);
    }

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM customers cu ${where}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT cu.*,
                COUNT(o.id) AS order_count,
                COALESCE(SUM(CASE WHEN o.order_status != 'cancelled' THEN o.total END), 0) AS total_spent,
                MAX(o.created_at) AS last_order_at
           FROM customers cu
           LEFT JOIN orders o ON o.customer_id = cu.id
           ${where}
          GROUP BY cu.id
          ORDER BY cu.created_at DESC, cu.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    res.json({
      items: rows.map(customerRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/** GET /api/admin/customers/:id — contact + order history. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const row = Number.isInteger(id)
      ? db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
      : null;
    if (!row) return res.status(404).json({ error: 'Customer not found.' });

    const orders = db
      .prepare(
        `SELECT o.id, o.order_number, o.order_status, o.payment_status,
                o.subtotal, o.discount_amount, o.total, o.created_at,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
           FROM orders o WHERE o.customer_id = ?
          ORDER BY o.created_at DESC, o.id DESC`
      )
      .all(id);

    const stats = db
      .prepare(
        `SELECT COUNT(*) AS order_count,
                COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total END), 0) AS total_spent,
                MIN(created_at) AS first_order_at
           FROM orders WHERE customer_id = ?`
      )
      .get(id);

    return res.json({
      customer: {
        ...customerRow(row),
        order_count: stats.order_count,
        total_spent: stats.total_spent,
        first_order_at: stats.first_order_at,
        orders,
      },
    });
  })
);

/** PUT /api/admin/customers/:id — update permitted contact fields. */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Customer not found.' });

    const v = new Validator(req.body);
    v.string('name', { label: 'Name', min: 2, max: 120 });
    v.email('email');
    v.string('phone', { label: 'Phone', max: 40, required: false });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const clash = db
      .prepare('SELECT id FROM customers WHERE email = ? COLLATE NOCASE AND id != ?')
      .get(v.value.email, id);
    if (clash) {
      return res.status(409).json({
        error: 'Another customer already uses this email.',
        details: { email: 'This email is already in use.' },
      });
    }

    db.prepare(
      `UPDATE customers
          SET name = ?, email = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`
    ).run(v.value.name, v.value.email.toLowerCase(), v.value.phone, id);

    const updated = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(id);
    return res.json({ customer: customerRow(updated) });
  })
);

export default router;
