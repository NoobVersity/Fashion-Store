import express from 'express';
import { getDb } from '../database/db.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/** GET /api/categories — active categories with active product counts. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = getDb()
      .prepare(
        `SELECT c.id, c.name, c.slug, c.description,
                (SELECT COUNT(*) FROM products p
                  WHERE p.category_id = c.id AND p.is_active = 1) AS product_count
           FROM categories c
          WHERE c.is_active = 1
          ORDER BY c.name COLLATE NOCASE`
      )
      .all();
    res.json({ categories });
  })
);

export default router;
