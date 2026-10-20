import { getDb } from '../database/db.js';

/**
 * Discount resolution + amount calculation. All validation happens on
 * the server: expired, inactive, exhausted or minimum-not-met codes
 * are rejected, and an order total can never go below zero.
 */

export function findDiscount(code) {
  return getDb()
    .prepare('SELECT * FROM discounts WHERE code = ? COLLATE NOCASE')
    .get(String(code).trim());
}

/** Returns { ok: true, amountCents } or { ok: false, error }. */
export function calculateDiscountAmount(discount, subtotalCents) {
  const now = Date.now();

  if (!discount.is_active) {
    return { ok: false, error: 'This discount code is not active.' };
  }
  if (discount.starts_at && new Date(discount.starts_at).getTime() > now) {
    return { ok: false, error: 'This discount code is not active yet.' };
  }
  if (discount.expires_at && new Date(discount.expires_at).getTime() <= now) {
    return { ok: false, error: 'This discount code has expired.' };
  }
  if (
    discount.usage_limit !== null &&
    discount.usage_count >= discount.usage_limit
  ) {
    return { ok: false, error: 'This discount code has reached its usage limit.' };
  }
  if (subtotalCents < discount.minimum_order_value) {
    return {
      ok: false,
      error: `This code requires a minimum order of ${formatCents(
        discount.minimum_order_value
      )}.`,
    };
  }

  let amount =
    discount.discount_type === 'percentage'
      ? Math.round((subtotalCents * discount.discount_value) / 100)
      : discount.discount_value;

  // Never negative, never more than the subtotal.
  amount = Math.max(0, Math.min(amount, subtotalCents));
  return { ok: true, amountCents: amount };
}

/**
 * Full validation of a submitted code against a subtotal.
 * No code → { ok: true, amountCents: 0, discount: null }.
 */
export function resolveDiscountCode(code, subtotalCents) {
  if (!code || !String(code).trim()) {
    return { ok: true, amountCents: 0, discount: null };
  }
  const discount = findDiscount(code);
  if (!discount) {
    return { ok: false, error: 'Invalid discount code.' };
  }
  const result = calculateDiscountAmount(discount, subtotalCents);
  if (!result.ok) return result;
  return { ok: true, amountCents: result.amountCents, discount };
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}
