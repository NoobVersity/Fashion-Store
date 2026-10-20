import crypto from 'node:crypto';
import { getDb } from '../database/db.js';
import { resolveDiscountCode } from './discountService.js';

/**
 * Order creation and lifecycle.
 *
 * Checkout is fully server-authoritative:
 *   - prices are read from the database (never from the browser),
 *   - stock is validated and decremented inside a transaction,
 *   - discount codes are validated server-side,
 *   - totals are computed on the server,
 *   - a client-supplied idempotency token prevents duplicate orders.
 */

export class CheckoutError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const ORDER_TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const ORDER_STATUSES = Object.keys(ORDER_TRANSITIONS);

export function allowedNextStatuses(current) {
  return ORDER_TRANSITIONS[current] || [];
}

/** Public shape of an order (used by checkout confirmation). */
export function orderToPublic(order, items) {
  return {
    id: order.id,
    order_number: order.order_number,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_phone: order.customer_phone,
    shipping_address: order.shipping_address,
    order_note: order.order_note,
    subtotal: order.subtotal,
    discount_amount: order.discount_amount,
    discount_code: order.discount_code,
    total: order.total,
    order_status: order.order_status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    created_at: order.created_at,
    items: items.map((i) => ({
      id: i.id,
      product_id: i.product_id,
      product_name_snapshot: i.product_name_snapshot,
      variant_snapshot: i.variant_snapshot,
      unit_price: i.unit_price,
      quantity: i.quantity,
      line_total: i.line_total,
    })),
  };
}

export function getOrderWithItems(orderId) {
  const db = getDb();
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) return null;
  const items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id')
    .all(orderId);
  return orderToPublic(order, items);
}

/**
 * Creates an order + items, deducts stock and records the discount in
 * a single database transaction. Throws CheckoutError on any
 * validation failure (everything rolls back).
 */
export function placeOrder({
  items,
  customer,
  shippingAddress,
  orderNote,
  discountCode,
  checkoutToken,
}) {
  const db = getDb();

  const tx = db.transaction(() => {
    // ---- duplicate submission (idempotency token) --------------------
    const existing = db
      .prepare('SELECT id FROM orders WHERE checkout_token = ?')
      .get(checkoutToken);
    if (existing) {
      return { duplicate: true, order: getOrderWithItems(existing.id) };
    }

    // ---- merge identical lines ---------------------------------------
    const merged = new Map();
    for (const item of items) {
      const key = `${item.productId}|${item.size}|${item.color}`;
      const prev = merged.get(key);
      if (prev) prev.quantity += item.quantity;
      else merged.set(key, { ...item });
    }

    // ---- validate products, variants, stock; compute subtotal --------
    const lines = [];
    let subtotal = 0;
    for (const item of merged.values()) {
      const product = db
        .prepare(
          `SELECT p.id, p.name, p.price, p.is_active, c.is_active AS category_active
             FROM products p
             JOIN categories c ON c.id = p.category_id
            WHERE p.id = ?`
        )
        .get(item.productId);
      if (!product || !product.is_active || !product.category_active) {
        throw new CheckoutError(
          400,
          'One of the selected products is no longer available.',
          { productId: item.productId }
        );
      }
      const variant = db
        .prepare(
          'SELECT * FROM product_variants WHERE product_id = ? AND size = ? AND color = ?'
        )
        .get(item.productId, item.size, item.color);
      if (!variant) {
        throw new CheckoutError(
          400,
          `The selected size/color is unavailable for ${product.name}.`,
          { productId: item.productId }
        );
      }
      if (variant.stock_quantity < item.quantity) {
        throw new CheckoutError(
          409,
          `Not enough stock for ${product.name} (${item.size} / ${item.color}) — only ${variant.stock_quantity} left.`,
          {
            productId: item.productId,
            variantId: variant.id,
            available: variant.stock_quantity,
          }
        );
      }
      lines.push({ product, variant, quantity: item.quantity });
      subtotal += product.price * item.quantity;
    }

    if (lines.length === 0) {
      throw new CheckoutError(400, 'Your cart is empty.');
    }

    // ---- discount ----------------------------------------------------
    const discountResult = resolveDiscountCode(discountCode, subtotal);
    if (!discountResult.ok) {
      throw new CheckoutError(400, discountResult.error, {
        discount_code: discountResult.error,
      });
    }
    const discountAmount = discountResult.amountCents;
    const total = subtotal - discountAmount;
    if (total < 0) {
      throw new CheckoutError(400, 'Invalid discount — the total cannot be negative.');
    }

    // ---- customer record (guest checkout, one row per email) ---------
    const email = customer.email.toLowerCase();
    db.prepare(
      `INSERT INTO customers (name, email, phone)
       VALUES (?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         phone = excluded.phone,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`
    ).run(customer.name, email, customer.phone || '');
    const customerRow = db
      .prepare('SELECT id FROM customers WHERE email = ? COLLATE NOCASE')
      .get(email);

    // ---- insert order + items ----------------------------------------
    const tempNumber = `TMP-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const info = db
      .prepare(
        `INSERT INTO orders (
           order_number, checkout_token, customer_id, customer_name, customer_email,
           customer_phone, shipping_address, order_note, subtotal, discount_amount,
           discount_code, total, order_status, payment_method, payment_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'simulated', 'simulated')`
      )
      .run(
        tempNumber,
        checkoutToken,
        customerRow ? customerRow.id : null,
        customer.name,
        email,
        customer.phone || '',
        shippingAddress,
        orderNote || '',
        subtotal,
        discountAmount,
        discountResult.discount ? discountResult.discount.code : null,
        total
      );
    const orderId = Number(info.lastInsertRowid);

    const insertItem = db.prepare(
      `INSERT INTO order_items (
         order_id, product_id, product_name_snapshot, variant_snapshot,
         unit_price, quantity, line_total
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    for (const line of lines) {
      insertItem.run(
        orderId,
        line.product.id,
        line.product.name,
        `${line.variant.size} / ${line.variant.color}`,
        line.product.price,
        line.quantity,
        line.product.price * line.quantity
      );
    }

    // ---- deduct stock (guarded, can never go negative) ---------------
    const deduct = db.prepare(
      `UPDATE product_variants
          SET stock_quantity = stock_quantity - ?
        WHERE id = ? AND stock_quantity >= ?`
    );
    for (const line of lines) {
      const result = deduct.run(line.quantity, line.variant.id, line.quantity);
      if (result.changes === 0) {
        throw new CheckoutError(
          409,
          `Not enough stock for ${line.product.name} (${line.variant.size} / ${line.variant.color}).`
        );
      }
    }

    // ---- record discount usage (guarded by usage limit) --------------
    if (discountResult.discount) {
      const used = db
        .prepare(
          `UPDATE discounts
              SET usage_count = usage_count + 1,
                  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
            WHERE id = ? AND (usage_limit IS NULL OR usage_count < usage_limit)`
        )
        .run(discountResult.discount.id);
      if (used.changes === 0) {
        throw new CheckoutError(409, 'This discount code is no longer available.');
      }
    }

    // ---- final, unique order number ----------------------------------
    const orderNumber = `TH-${String(orderId).padStart(6, '0')}`;
    db.prepare('UPDATE orders SET order_number = ? WHERE id = ?').run(
      orderNumber,
      orderId
    );

    return { duplicate: false, order: getOrderWithItems(orderId) };
  });

  return tx();
}

/**
 * Applies a valid status transition. Cancelling restores stock exactly
 * once (guarded by orders.stock_restored) and returns the discount
 * usage to the code, all inside one transaction.
 */
export function setOrderStatus(orderId, nextStatus) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!current) return { ok: false, status: 404, error: 'Order not found.' };

  const allowed = allowedNextStatuses(current.order_status);
  if (!ORDER_STATUSES.includes(nextStatus)) {
    return { ok: false, status: 400, error: 'Unknown order status.' };
  }
  if (!allowed.includes(nextStatus)) {
    return {
      ok: false,
      status: 409,
      error: `An order cannot change from "${current.order_status}" to "${nextStatus}".`,
      allowed,
    };
  }

  const tx = db.transaction(() => {
    const now = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

    if (nextStatus === 'cancelled' && !current.stock_restored) {
      // Recreate/restore the variant stock (UPSERT keeps history intact
      // even if an admin removed the variant after the purchase).
      const restore = db.prepare(
        `INSERT INTO product_variants (product_id, size, color, stock_quantity)
         SELECT product_id, ?, ?, ?
           FROM order_items WHERE id = ?
         ON CONFLICT(product_id, size, color)
         DO UPDATE SET stock_quantity = stock_quantity + excluded.stock_quantity`
      );
      const items = db
        .prepare(
          `SELECT id, product_id, product_name_snapshot, variant_snapshot, quantity
             FROM order_items WHERE order_id = ?`
        )
        .all(orderId);
      for (const item of items) {
        if (!item.product_id) continue;
        const [size, color] = item.variant_snapshot.split(' / ');
        restore.run(size, color, item.quantity, item.id);
      }
      if (current.discount_code) {
        db.prepare(
          `UPDATE discounts
              SET usage_count = MAX(usage_count - 1, 0),
                  updated_at = ${now}
            WHERE code = ? COLLATE NOCASE`
        ).run(current.discount_code);
      }
    }

    db.prepare(
      `UPDATE orders
          SET order_status = ?, stock_restored = ?, updated_at = ${now}
        WHERE id = ?`
    ).run(nextStatus, nextStatus === 'cancelled' ? 1 : current.stock_restored, orderId);

    return getOrderWithItems(orderId);
  });

  return { ok: true, order: tx() };
}
