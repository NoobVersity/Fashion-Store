import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator } from '../../validation/validate.js';
import { getLowStockThreshold } from '../../services/settingsService.js';

const router = express.Router();

const FILTERS = {
  all: '1 = 1',
  low: 'v.stock_quantity > 0 AND v.stock_quantity <= ?',
  out: 'v.stock_quantity = 0',
  in: 'v.stock_quantity > ?',
};

/**
 * GET /api/admin/inventory — every variant with product context.
 * `filter` highlights low-stock and out-of-stock rows.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDb();
    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 20;
    limit = Math.min(limit, 100);

    const threshold = getLowStockThreshold();
    const filter = FILTERS[String(req.query.filter || 'all')] || FILTERS.all;
    const params = [];
    if (filter.includes('?')) params.push(threshold);

    const whereExtra = filter === '1 = 1' ? '' : ` AND ${filter}`;
    const search = String(req.query.search || '').trim();
    let searchSql = '';
    if (search) {
      searchSql =
        " AND (p.name LIKE ? ESCAPE '\\' OR v.size LIKE ? ESCAPE '\\' OR v.color LIKE ? ESCAPE '\\')";
      const like = `%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      params.push(like, like, like);
    }

    const baseFrom = `
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
      JOIN categories c ON c.id = p.category_id
     WHERE 1 = 1${whereExtra}${searchSql}`;

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total ${baseFrom}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT v.id AS variant_id, p.id AS product_id, p.name AS product_name,
                p.slug AS product_slug, p.is_active, v.size, v.color,
                v.stock_quantity, c.name AS category_name
         ${baseFrom}
         ORDER BY v.stock_quantity ASC, p.name ASC, v.size
         LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    res.json({
      items: rows,
      threshold,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/** PATCH /api/admin/inventory/:variantId — direct stock update (>= 0). */
router.patch(
  '/:variantId',
  asyncHandler(async (req, res) => {
    const variantId = Number(req.params.variantId);
    const db = getDb();
    const existing = Number.isInteger(variantId)
      ? db.prepare('SELECT * FROM product_variants WHERE id = ?').get(variantId)
      : null;
    if (!existing) {
      return res.status(404).json({ error: 'Variant not found.' });
    }

    const v = new Validator(req.body);
    v.int('stock_quantity', { label: 'Stock quantity', min: 0, max: 1_000_000 });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    db.prepare('UPDATE product_variants SET stock_quantity = ? WHERE id = ?').run(
      v.value.stock_quantity,
      variantId
    );

    const updated = db
      .prepare(
        `SELECT v.id AS variant_id, p.id AS product_id, p.name AS product_name,
                p.slug AS product_slug, p.is_active, v.size, v.color,
                v.stock_quantity, c.name AS category_name
           FROM product_variants v
           JOIN products p ON p.id = v.product_id
           JOIN categories c ON c.id = p.category_id
          WHERE v.id = ?`
      )
      .get(variantId);

    return res.json({ variant: updated });
  })
);

export default router;
