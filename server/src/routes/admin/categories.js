import express from 'express';
import { getDb } from '../../database/db.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator, SLUG_PATTERN } from '../../validation/validate.js';
import { ensureUniqueSlug } from '../../services/slugService.js';

const router = express.Router();

function categoryById(id) {
  return getDb()
    .prepare(
      `SELECT c.*,
              (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
         FROM categories c WHERE c.id = ?`
    )
    .get(id);
}

/** GET /api/admin/categories — every category incl. inactive ones. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = String(req.query.search || '').trim();
    const params = [];
    let where = '';
    if (search) {
      where = "WHERE c.name LIKE ? ESCAPE '\\'";
      params.push(`%${search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
    }
    const categories = getDb()
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
           FROM categories c
           ${where}
          ORDER BY c.name COLLATE NOCASE`
      )
      .all(...params);
    res.json({
      categories: categories.map((c) => ({
        ...c,
        is_active: Boolean(c.is_active),
      })),
    });
  })
);

function readCategoryInput(req) {
  const v = new Validator(req.body);
  v.string('name', { label: 'Name', min: 2, max: 60 });
  v.string('description', { label: 'Description', max: 300, required: false });
  v.bool('is_active', { label: 'Active status' });
  return v;
}

/** POST /api/admin/categories — names must be unique. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const v = readCategoryInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    const db = getDb();
    const clash = db
      .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE')
      .get(v.value.name);
    if (clash) {
      return res.status(409).json({
        error: 'A category with this name already exists.',
        details: { name: 'A category with this name already exists.' },
      });
    }
    const slug = ensureUniqueSlug('categories', v.value.name);
    const info = db
      .prepare(
        'INSERT INTO categories (name, slug, description, is_active) VALUES (?, ?, ?, ?)'
      )
      .run(v.value.name, slug, v.value.description, v.value.is_active ? 1 : 0);
    return res.status(201).json({ category: categoryById(Number(info.lastInsertRowid)) });
  })
);

/** PUT /api/admin/categories/:id */
router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT * FROM categories WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Category not found.' });

    const v = readCategoryInput(req);
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    const clash = db
      .prepare('SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?')
      .get(v.value.name, id);
    if (clash) {
      return res.status(409).json({
        error: 'A category with this name already exists.',
        details: { name: 'A category with this name already exists.' },
      });
    }

    db.prepare(
      `UPDATE categories
          SET name = ?, description = ?, is_active = ?,
              updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE id = ?`
    ).run(v.value.name, v.value.description, v.value.is_active ? 1 : 0, id);

    return res.json({ category: categoryById(id) });
  })
);

/** PATCH /api/admin/categories/:id/status — activate/deactivate. */
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT id FROM categories WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Category not found.' });

    const v = new Validator(req.body);
    v.bool('is_active', { label: 'Active status' });
    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }
    db.prepare(
      `UPDATE categories SET is_active = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`
    ).run(v.value.is_active ? 1 : 0, id);

    return res.json({ category: categoryById(id) });
  })
);

/** DELETE /api/admin/categories/:id — only while it has no products. */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const db = getDb();
    const existing = Number.isInteger(id)
      ? db.prepare('SELECT id FROM categories WHERE id = ?').get(id)
      : null;
    if (!existing) return res.status(404).json({ error: 'Category not found.' });

    const count = db
      .prepare('SELECT COUNT(*) AS c FROM products WHERE category_id = ?')
      .get(id).c;
    if (count > 0) {
      return res.status(409).json({
        error: `This category still contains ${count} product(s). Reassign or delete them first.`,
      });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return res.status(204).end();
  })
);

export default router;
