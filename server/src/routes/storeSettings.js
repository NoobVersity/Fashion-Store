import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getPublicSettings } from '../services/settingsService.js';

const router = express.Router();

/** GET /api/store-settings/public — safe display settings only. */
router.get(
  '/public',
  asyncHandler(async (req, res) => {
    res.json(getPublicSettings());
  })
);

export default router;
