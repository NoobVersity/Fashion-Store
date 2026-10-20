import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Validator } from '../validation/validate.js';
import { resolveDiscountCode } from '../services/discountService.js';

const router = express.Router();

/**
 * POST /api/discounts/validate — checkout-time discount check.
 * Body: { code, subtotal } (subtotal in cents). The server, not the
 * browser, decides the final discount amount.
 */
router.post(
  '/validate',
  asyncHandler(async (req, res) => {
    const v = new Validator(req.body);
    v.string('code', { label: 'Discount code', max: 40 });
    v.int('subtotal', { label: 'Subtotal', min: 0, max: 1_000_000_000 });
    if (!v.ok) {
      return res.status(400).json({ error: 'Validation failed.', details: v.errors });
    }

    const result = resolveDiscountCode(v.value.code, v.value.subtotal);
    if (!result.ok) {
      return res.status(400).json({ error: result.error });
    }
    if (!result.discount) {
      return res.json({ valid: true, code: null, discount_amount: 0 });
    }
    return res.json({
      valid: true,
      code: result.discount.code,
      discount_type: result.discount.discount_type,
      discount_value: result.discount.discount_value,
      discount_amount: result.amountCents,
      minimum_order_value: result.discount.minimum_order_value,
    });
  })
);

export default router;
