import express from 'express';
import { getDb } from '../database/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

const SORTS = {
  newest: 'p.created_at DESC, p.id DESC',
  price_asc: 'p.price ASC, p.id ASC',
  price_desc: 'p.price DESC, p.id DESC',
};

/** Escapes LIKE wildcards in user search input. */
function escapeLike(text) {
  return text.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function variantSummary(productId, variantRows) {
  const rows = variantRows.filter((v) => v.product_id === productId);
  const inStock = rows.filter((v) => v.stock_quantity > 0);
  const sizes = [...new Set(inStock.map((v) => v.size))];
  const colors = [...new Set(inStock.map((v) => v.color))];
  const totalStock = rows.reduce((sum, v) => sum + v.stock_quantity, 0);
  return { sizes, colors, total_stock: totalStock, in_stock: totalStock > 0 };
}

function toSummary(row, variantRows) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    image_path: row.image_path,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    ...variantSummary(row.id, variantRows),
  };
}

/**
 * GET /api/products
 * Public catalog: active products in active categories, with search,
 * category/size/price filters, sorting and pagination.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const db = getDb();

    let page = Number.parseInt(req.query.page, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    let limit = Number.parseInt(req.query.limit, 10);
    if (!Number.isInteger(limit) || limit < 1) limit = 12;
    limit = Math.min(limit, 48);

    const where = ['p.is_active = 1', 'c.is_active = 1'];
    const params = [];

    const search = String(req.query.search || '').trim();
    if (search) {
      where.push("p.name LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(search)}%`);
    }

    const category = String(req.query.category || '').trim();
    if (category) {
      where.push('(c.slug = ? OR c.name = ? COLLATE NOCASE)');
      params.push(category, category);
    }

    const size = String(req.query.size || '').trim();
    if (size) {
      where.push(
        'EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.size = ? COLLATE NOCASE)'
      );
      params.push(size);
    }

    for (const [key, clause] of [
      ['minPrice', 'p.price >= ?'],
      ['maxPrice', 'p.price <= ?'],
    ]) {
      const raw = req.query[key];
      if (raw !== undefined && raw !== '') {
        const n = Math.round(Number(raw));
        if (Number.isFinite(n) && n >= 0) {
          where.push(clause);
          params.push(n);
        }
      }
    }

    const orderBy = SORTS[req.query.sort] || SORTS.newest;
    const whereSql = where.join(' AND ');

    const { total } = db
      .prepare(
        `SELECT COUNT(*) AS total
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE ${whereSql}`
      )
      .get(...params);

    const rows = db
      .prepare(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE ${whereSql}
          ORDER BY ${orderBy}
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    const ids = rows.map((r) => r.id);
    const variantRows = ids.length
      ? db
          .prepare(
            `SELECT product_id, size, color, stock_quantity
               FROM product_variants
              WHERE product_id IN (${ids.map(() => '?').join(',')})`
          )
          .all(...ids)
      : [];

    res.json({
      items: rows.map((r) => toSummary(r, variantRows)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/**
 * GET /api/products/:slug — public product detail with variants.
 */
router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const db = getDb();
    const row = db
      .prepare(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
           FROM products p JOIN categories c ON c.id = p.category_id
          WHERE p.slug = ? AND p.is_active = 1 AND c.is_active = 1`
      )
      .get(String(req.params.slug));
    if (!row) return res.status(404).json({ error: 'Product not found.' });

    const variants = db
      .prepare(
        'SELECT id, size, color, stock_quantity FROM product_variants WHERE product_id = ? ORDER BY size, color'
      )
      .all(row.id);

    return res.json({
      product: {
        ...toSummary(row, variants),
        variants,
      },
    });
  })
);

export default router;
