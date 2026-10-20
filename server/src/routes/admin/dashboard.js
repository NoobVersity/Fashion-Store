import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getDashboardStats } from '../../services/statsService.js';

const router = express.Router();

/** GET /api/admin/dashboard/stats — live figures from the database. */
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    res.json({ stats: getDashboardStats() });
  })
);

export default router;
