import express from 'express';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { Validator } from '../validation/validate.js';
import { placeOrder, CheckoutError } from '../services/orderService.js';

const router = express.Router();

/**
 * POST /api/checkout — simulated demo checkout.
 *
 * The server revalidates everything: products, variants, stock,
 * discount codes, and it recomputes all totals from database prices.
 * No card data is collected; payment_method = 'simulated'.
 *
 * checkout_token is a client-generated idempotency key that prevents
 * duplicate orders from double submissions.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body || {};
    const customer = body.customer || {};

    // Flatten customer fields so errors map to simple keys.
    const v = new Validator({
      ...body,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
    });
    v.string('name', { label: 'Customer name', min: 2, max: 120 });
    v.email('email');
    v.string('phone', { label: 'Phone number', max: 40, required: false });
    v.string('shipping_address', { label: 'Shipping address', min: 5, max: 500 });
    v.string('order_note', { label: 'Order note', max: 500, required: false });
    v.string('checkout_token', { label: 'Checkout token', min: 8, max: 100 });

    // Cart items
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      v.errors.items = 'Your cart is empty.';
    } else if (items.length > 50) {
      v.errors.items = 'Too many items in the cart (max 50).';
    } else {
      items.forEach((item, i) => {
        if (!item || typeof item !== 'object') {
          v.errors.items = `Item ${i + 1} is invalid.`;
          return;
        }
        const pid = Number(item.productId);
        const qty = Number(item.quantity);
        if (!Number.isInteger(pid) || pid < 1) {
          v.errors.items = `Item ${i + 1}: invalid product.`;
        } else if (
          typeof item.size !== 'string' ||
          !item.size.trim() ||
          item.size.length > 20
        ) {
          v.errors.items = `Item ${i + 1}: size is required.`;
        } else if (
          typeof item.color !== 'string' ||
          !item.color.trim() ||
          item.color.length > 40
        ) {
          v.errors.items = `Item ${i + 1}: color is required.`;
        } else if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
          v.errors.items = `Item ${i + 1}: quantity must be between 1 and 99.`;
        }
      });
    }

    if (!v.ok) {
      return res.status(400).json({ error: 'Validation failed.', details: v.errors });
    }

    try {
      const result = placeOrder({
        items: items.map((item) => ({
          productId: Number(item.productId),
          size: String(item.size).trim(),
          color: String(item.color).trim(),
          quantity: Number(item.quantity),
        })),
        customer: {
          name: v.value.name,
          email: v.value.email,
          phone: v.value.phone,
        },
        shippingAddress: v.value.shipping_address,
        orderNote: v.value.order_note,
        discountCode: typeof body.discount_code === 'string' ? body.discount_code : '',
        checkoutToken: v.value.checkout_token,
      });

      if (result.duplicate) {
        return res.status(409).json({
          error: 'This order was already submitted.',
          duplicate: true,
          order: result.order,
        });
      }
      return res.status(201).json({ order: result.order, duplicate: false });
    } catch (err) {
      if (err instanceof CheckoutError) {
        return res.status(err.status).json({ error: err.message, ...err.extra });
      }
      if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message });
      }
      throw err;
    }
  })
);

export default router;
