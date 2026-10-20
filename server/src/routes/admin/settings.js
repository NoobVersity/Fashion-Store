import express from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { Validator } from '../../validation/validate.js';
import {
  getAllSettings,
  saveSettings,
} from '../../services/settingsService.js';

const router = express.Router();

/**
 * GET /api/admin/settings — all editable display settings.
 * Secrets/env vars are never exposed here.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ settings: getAllSettings() });
  })
);

/** PUT /api/admin/settings — server-validated key updates. */
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.string('store_name', { label: 'Store name', min: 2, max: 80 });
    v.email('contact_email');
    v.string('contact_phone', { label: 'Contact phone', max: 40, required: false });
    v.string('currency', {
      label: 'Currency',
      min: 3,
      max: 3,
      pattern: /^[A-Za-z]{3}$/,
      patternMessage: 'Currency must be a 3-letter code, e.g. USD.',
    });
    v.string('currency_symbol', {
      label: 'Currency symbol',
      min: 1,
      max: 5,
    });
    v.int('low_stock_threshold', { label: 'Low-stock threshold', min: 0, max: 100_000 });
    v.string('store_description', { label: 'Store description', max: 500 });

    if (!v.ok) {
      return res
        .status(400)
        .json({ error: 'Validation failed.', details: v.errors });
    }

    saveSettings({
      store_name: v.value.store_name,
      contact_email: v.value.contact_email,
      contact_phone: v.value.contact_phone,
      currency: v.value.currency.toUpperCase(),
      currency_symbol: v.value.currency_symbol,
      low_stock_threshold: String(v.value.low_stock_threshold),
      store_description: v.value.store_description,
    });

    res.json({ settings: getAllSettings() });
  })
);

export default router;
