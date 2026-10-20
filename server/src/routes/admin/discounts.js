import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator } from '../../validation/validate.js';

const router = express.Router();

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]*$/;

function discountRow(row) {
  return {
    id: row.id,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    minimum_order_value: row.minimum_order_value,
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    usage_limit: row.usage_limit,
    usage_count: row.usage_count,
    is_active: Boolean(row.is_active),
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function readDiscountInput(req) {
  const v = new Validator(req.body);
  v.string('code', {
    label: 'Code',
    min: 3,
    max: 40,
    pattern: CODE_PATTERN,
    patternMessage:
      'Code may contain uppercase letters, numbers, dashes and underscores.',
  });
  v.oneOf('discount_type', ['percentage', 'fixed'], { label: 'Discount type' });
  // percentage → 1..100 ; fixed → cents (> 0)
  v.int('discount_value', { label: 'Value', min: 1, max: 1_000_000 });
  v.int('minimum_order_value', { label: 'Minimum order value', min: 0, max: 1_000_000_000 });
  v.isoDate('starts_at', { label: 'Start date' });
  v.isoDate('expires_at', { label: 'Expiry date' });
  // usage_limit: optional positive integer or null
  const rawLimit = req.body.usage_limit;
  if (rawLimit === undefined || rawLimit === null || rawLimit === '') {
    v.value.usage_limit = null;
  } else {
    v.int('usage_limit', { label: 'Usage limit', min: 1, max: 1_000_000 });
  }
  v.bool('is_active', { label: 'Active status' });
  v.string('description', { label: 'Description', max: 200, required: false });

  // Cross-field rules
  if (v.ok && v.value.discount_type === 'percentage' && v.value.discount_value > 100) {
    v.errors.discount_value = 'Percentage discounts cannot exceed 100%.';
  }
  if (
    v.ok &&
    v.value.starts_at &&
    v.value.expires_at &&
    new Date(v.value.expires_at) <= new Date(v.value.starts_at)
  ) {
    v.errors.expires_at = 'Expiry date must be after the start date.';
  }
  return v;
}

/** GET /api/admin/discounts */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim().toUpperCase();
    const params = [];
    let where = '';
    if (search) {
      where = "WHERE code LIKE ? ESCAPE '\\'";
      params.push(`%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    }
    const rows = getDb()
      .prepare(`SELECT * FROM discounts ${where} ORDER BY created_at DESC, id DESC`)
      .all(...params);
    res.json({ items: rows.map(discountRow) });
  })
);

/** POST /api/admin/discounts */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const v = readDiscountInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    const db = getDb();
    const clash = db
      .prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE')
      .get(v.value.code);
    if (clash) {
      return res.status(409).json({
        error: 'A discount with this code already exists.',
        details: { code: 'This code is already in use.' },
      });
    }

    const info = db
      .prepare(
        `INSERT INTO discounts (code, discount_type, discount_value, minimum_order_value,
                                starts_at, expires_at, usage_limit, is_active, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        v.value.code,
        v.value.discount_type,
        v.value.discount_value,
        v.value.minimum_order_value,
        v.value.starts_at,
        v.value.expires_at,
        v.value.usage_limit,
        v.value.is_active ? 1 : 0,
        v.value.description
      );
    const created = db
      .prepare('SELECT * FROM discounts WHERE id = ?')
      .get(Number(info.lastInsertRowid));
    return res.status(201).json({ discount: discountRow(created) });
  })
);

/** PUT /api/admin/discounts/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT * FROM discounts WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Discount not found.' });

    const v = readDiscountInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    const clash = db
      .prepare('SELECT id FROM discounts WHERE code = ? COLLATE NOCASE AND id != ?')
      .get(v.value.code, id);
    if (clash) {
      return res.status(409).json({
        error: 'A discount with this code already exists.',
        details: { code: 'This code is already in use.' },
      });
    }

    db.prepare(
      `UPDATE discounts
          SET code = ?, discount_type = ?, discount_value = ?, minimum_order_value = ?,
              starts_at = ?, expires_at = ?, usage_limit = ?, is_active = ?, description = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`
    ).run(
      v.value.code,
      v.value.discount_type,
      v.value.discount_value,
      v.value.minimum_order_value,
      v.value.starts_at,
      v.value.expires_at,
      v.value.usage_limit,
      v.value.is_active ? 1 : 0,
      v.value.description,
      id
    );

    const updated = db.prepare('SELECT * FROM discounts WHERE id = ?').get(id);
    return res.json({ discount: discountRow(updated) });
  })
);

/** PATCH /api/admin/discounts/:id/status — activate/deactivate. */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT id FROM discounts WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Discount not found.' });

    const v = new Validator(req.body);
    v.bool('is_active', { label: 'Active status' });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    db.prepare(
      `UPDATE discounts SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    ).run(v.value.is_active ? 1 : 0, id);
    const updated = db.prepare('SELECT * FROM discounts WHERE id = ?').get(id);
    return res.json({ discount: discountRow(updated) });
  })
);

/** DELETE /api/admin/discounts/:id — used codes must be deactivated. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT * FROM discounts WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Discount not found.' });

    if (existing.usage_count > 0) {
      return res.status(409).json({
        error:
          'This discount has been used and is part of order history. Deactivate it instead of deleting it.',
      });
    }
    db.prepare('DELETE FROM discounts WHERE id = ?').run(id);
    return res.status(204).end();
  })
);

export default router;
