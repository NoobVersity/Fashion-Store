import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator, SLUG_PATTERN } from '../../validation/validate.js';
import { ensureUniqueSlug } from '../../services/slugService.js';

const router = express.Router();

/* ------------------------------------------------------------------ utils */

function variantRowsFor(productIds) {
  if (productIds.length === 0) return [];
  return getDb()
    .prepare(
      `SELECT id, product_id, size, color, stock_quantity
         FROM product_variants
        WHERE product_id IN (${productIds.map(() => '?').join(',')})
        ORDER BY size, color`
    )
    .all(...productIds);
}

/** Full admin representation of one product. */
export function adminProductById(id) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
         FROM products p JOIN categories c ON c.id = p.category_id
        WHERE p.id = ?`
    )
    .get(id);
  if (!row) return null;
  const variants = variantRowsFor([row.id]).map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    stock_quantity: v.stock_quantity,
  }));
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: row.price,
    image_path: row.image_path,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    variants,
    total_stock: variants.reduce((s, v) => s + v.stock_quantity, 0),
  };
}

/** Validates the shared product payload (create + update). */
function readProductInput(req) {
  const v = new Validator(req.body);
  v.string('name', { label: 'Name', min: 2, max: 120 });
  v.string('slug', {
    label: 'Slug',
    max: 120,
    required: false,
    pattern: SLUG_PATTERN,
    patternMessage:
      'Slug may contain lowercase letters, numbers and single dashes only.',
  });
  v.string('description', { label: 'Description', max: 2000, required: false });
  v.int('price', { label: 'Price', min: 0, max: 10_000_000 });
  v.int('category_id', { label: 'Category', min: 1 });
  v.string('image_path', {
    label: 'Image path',
    max: 500,
    pattern: /^(https?:\/\/|\/|data:image\/)/,
    patternMessage:
      'Image must be an http(s) URL or a local path like /images/products/item.svg.',
  });
  v.bool('is_active', { label: 'Active status' });

  // Variants (size + color + stock)
  const variants = [];
  const raw = Array.isArray(req.body.variants) ? req.body.variants : [];
  if (raw.length === 0) {
    v.errors.variants = 'Add at least one size/color variant.';
  } else if (raw.length > 100) {
    v.errors.variants = 'A product may have at most 100 variants.';
  } else {
    const seen = new Set();
    raw.forEach((item, i) => {
      const size = item && typeof item.size === 'string' ? item.size.trim() : '';
      const color = item && typeof item.color === 'string' ? item.color.trim() : '';
      const stock =
        item && item.stock_quantity !== undefined
          ? Number(item.stock_quantity)
          : NaN;
      if (!size || size.length > 20) {
        v.errors.variants = `Variant ${i + 1}: size is required (max 20 characters).`;
      } else if (!color || color.length > 40) {
        v.errors.variants = `Variant ${i + 1}: color is required (max 40 characters).`;
      } else if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
        v.errors.variants = `Variant ${i + 1}: stock must be a whole number between 0 and 1,000,000.`;
      } else {
        const key = `${size.toLowerCase()}|${color.toLowerCase()}`;
        if (seen.has(key)) {
          v.errors.variants = `Variant ${i + 1}: duplicate size/color combination.`;
        } else {
          seen.add(key);
          variants.push({ size, color, stock_quantity: stock });
        }
      }
    });
  }

  return { v, variants };
}

function categoryExists(id) {
  return getDb().prepare('SELECT id FROM categories WHERE id = ?').get(id);
}

/* ----------------------------------------------------------------- routes */

/** GET /api/admin/products — searchable, paginated admin list. */
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
      where.push("(p.name LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\')");
      params.push(`%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
      params.push(`%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    }
    const status = String(req.query.status || 'all');
    if (status === 'active') where.push('p.is_active = 1');
    if (status === 'inactive') where.push('p.is_active = 0');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM products p ${whereSql}`)
      .get(...params);

    const rows = db
      .prepare(
        `SELECT p.*, c.name AS category_name, c.slug AS category_slug
           FROM products p JOIN categories c ON c.id = p.category_id
           ${whereSql}
          ORDER BY p.created_at DESC, p.id DESC
          LIMIT ? OFFSET ?`
      )
      .all(...params, limit, (page - 1) * limit);

    const variants = variantRowsFor(rows.map((r) => r.id));
    const items = rows.map((row) => {
      const vs = variants.filter((v) => v.product_id === row.id);
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: row.price,
        image_path: row.image_path,
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
        category: {
          id: row.category_id,
          name: row.category_name,
          slug: row.category_slug,
        },
        variants: vs.map((v) => ({
          id: v.id,
          size: v.size,
          color: v.color,
          stock_quantity: v.stock_quantity,
        })),
        total_stock: vs.reduce((s, v) => s + v.stock_quantity, 0),
      };
    });

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  })
);

/** POST /api/admin/products — create a product with variants. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { v, variants } = readProductInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    if (!categoryExists(v.value.category_id)) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: { category_id: 'Selected category does not exist.' },
      });
    }

    const db = getDb();
    const slug = v.value.slug || ensureUniqueSlug('products', v.value.name);
    if (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug)) {
      return res
        .status(409)
        .json({ error: 'A product with this slug already exists.' });
    }

    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO products (category_id, name, slug, description, price, image_path, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          v.value.category_id,
          v.value.name,
          slug,
          v.value.description,
          v.value.price,
          v.value.image_path,
          v.value.is_active ? 1 : 0
        );
      const productId = Number(info.lastInsertRowid);
      const insertVariant = db.prepare(
        `INSERT INTO product_variants (product_id, size, color, stock_quantity)
         VALUES (?, ?, ?, ?)`
      );
      for (const variant of variants) {
        insertVariant.run(productId, variant.size, variant.color, variant.stock_quantity);
      }
      return productId;
    });

    const productId = tx();
    return res.status(201).json({ product: adminProductById(productId) });
  })
);

/** GET /api/admin/products/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const product = Number.isInteger(id) ? adminProductById(id) : null;
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    return res.json({ product });
  })
);

/** PUT /api/admin/products/:id — full update, variants replaced. */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT * FROM products WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const { v, variants } = readProductInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    if (!categoryExists(v.value.category_id)) {
      return res.status(400).json({
        error: 'Validation failed.',
        details: { category_id: 'Selected category does not exist.' },
      });
    }

    const slug = v.value.slug || existing.slug;
    const slugOwner = db
      .prepare('SELECT id FROM products WHERE slug = ? AND id != ?')
      .get(slug, id);
    if (slugOwner) {
      return res
        .status(409)
        .json({ error: 'A product with this slug already exists.' });
    }

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE products
            SET category_id = ?, name = ?, slug = ?, description = ?, price = ?,
                image_path = ?, is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?`
      ).run(
        v.value.category_id,
        v.value.name,
        slug,
        v.value.description,
        v.value.price,
        v.value.image_path,
        v.value.is_active ? 1 : 0,
        id
      );
      // Replace variants wholesale (stock is part of the variant).
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      const insertVariant = db.prepare(
        `INSERT INTO product_variants (product_id, size, color, stock_quantity)
         VALUES (?, ?, ?, ?)`
      );
      for (const variant of variants) {
        insertVariant.run(id, variant.size, variant.color, variant.stock_quantity);
      }
    });
    tx();

    return res.json({ product: adminProductById(id) });
  })
);

/** PATCH /api/admin/products/:id/status — activate/deactivate. */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT id FROM products WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const v = new Validator(req.body);
    v.bool('is_active', { label: 'Active status' });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    db.prepare(
      `UPDATE products SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    ).run(v.value.is_active ? 1 : 0, id);

    return res.json({ product: adminProductById(id) });
  })
);

/**
 * DELETE /api/admin/products/:id — only when the product is not part
 * of any order history (otherwise archive/deactivate instead, so
 * historical orders never lose their references).
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT id FROM products WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Product not found.' });

    const referenced = db
      .prepare('SELECT COUNT(*) AS c FROM order_items WHERE product_id = ?')
      .get(id).c;
    if (referenced > 0) {
      return res.status(409).json({
        error:
          'This product appears in order history and cannot be deleted. Deactivate it instead to preserve records.',
      });
    }

    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return res.status(204).end();
  })
);

export default router;
