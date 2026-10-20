import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator } from '../../validation/validate.js';
import {
  setOrderStatus,
  allowedNextStatuses,
  ORDER_STATUSES,
} from '../../services/orderService.js';

const router = express.Router();

function orderRow(row) {
  return {
    id: row.id,
    order_number: row.order_number,
    customer_id: row.customer_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    customer_phone: row.customer_phone,
    shipping_address: row.shipping_address,
    order_note: row.order_note,
    subtotal: row.subtotal,
    discount_amount: row.discount_amount,
    discount_code: row.discount_code,
    total: row.total,
    order_status: row.order_status,
    payment_method: row.payment_method,
    payment_status: row.payment_status,
    stock_restored: Boolean(row.stock_restored),
    item_count: row.item_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** GET /api/admin/orders — search + status filter + pagination. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDb();
    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 15;
    limit = Math.min(limit, 100);

    const where = [];
    const params = [];
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      where.push(
        "(o.order_number LIKE ? ESCAPE '\\' OR o.customer_name LIKE ? ESCAPE '\\' OR o.customer_email LIKE ? ESCAPE '\\')"
      );
      params.push(like, like, like);
    }
    const status = String(req.query.status || '');
    if (ORDER_STATUSES.includes(status)) {
      where.push('o.order_status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM orders o ${whereSql}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT o.*,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
           FROM orders o
           ${whereSql}
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    res.json({
      items: rows.map(orderRow),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/** GET /api/admin/orders/:id — full detail incl. items. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const db = getDb();
    const row = db
      .prepare(
        `SELECT o.*,
                (SELECT COUNT(*) FROM order_items i WHERE i.order_id = o.id) AS item_count
           FROM orders o WHERE o.id = ?`
      )
      .get(id);
    if (!row) return res.status(404).json({ error: 'Order not found.' });

    const items = db
      .prepare(
        `SELECT id, product_id, product_name_snapshot, variant_snapshot,
                unit_price, quantity, line_total
           FROM order_items WHERE order_id = ? ORDER BY id`
      )
      .all(id);

    return res.json({
      order: {
        ...orderRow(row),
        allowed_next: allowedNextStatuses(row.order_status),
        items,
      },
    });
  })
);

/**
 * PATCH /api/admin/orders/:id/status — validated transitions.
 * Cancelling restores stock exactly once (transactional, see
 * orderService.setOrderStatus).
 */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    const v = new Validator(req.body);
    v.oneOf('status', ORDER_STATUSES, { label: 'Status' });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    const result = setOrderStatus(id, v.value.status);
    if (!result.ok) {
      return res
        .status(result.status)
        .json({ error: result.error, allowed: result.allowed || undefined });
    }

    const db = getDb();
    const items = db
      .prepare(
        `SELECT id, product_id, product_name_snapshot, variant_snapshot,
                unit_price, quantity, line_total
           FROM order_items WHERE order_id = ? ORDER BY id`
      )
      .all(id);

    return res.json({
      order: {
        ...result.order,
        allowed_next: allowedNextStatuses(result.order.order_status),
        items,
      },
    });
  })
);

export default router;
