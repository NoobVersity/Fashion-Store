import { getDb } from '../database/db.js';
import { getLowStockThreshold } from './settingsService.js';

/**
 * Dashboard figures — every number comes from live database queries.
 * Revenue is reported for a clearly defined period (last 30 days) plus
 * all-time, and cancelled orders are excluded from revenue.
 */
export function getDashboardStats() {
  const db = getDb();
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);

  const totals = one(`
    SELECT
      (SELECT COUNT(*) FROM products)                        AS totalProducts,
      (SELECT COUNT(*) FROM products WHERE is_active = 1)    AS activeProducts,
      (SELECT COUNT(*) FROM orders)                          AS totalOrders,
      (SELECT COUNT(*) FROM orders WHERE order_status = 'pending') AS pendingOrders,
      (SELECT COUNT(*) FROM customers)                       AS totalCustomers
  `);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const revenue = one(`
    SELECT
      COALESCE(SUM(CASE WHEN created_at >= ? THEN total END), 0) AS revenue30d,
      COALESCE(SUM(total), 0)                                    AS revenueAllTime
    FROM orders WHERE order_status != 'cancelled'
  `, cutoff);

  const recentOrders = all(`
    SELECT id, order_number, customer_name, total, order_status, created_at
      FROM orders ORDER BY created_at DESC, id DESC LIMIT 8
  `);

  const threshold = getLowStockThreshold();
  const lowStock = all(`
    SELECT v.id AS variant_id, p.name AS product_name, v.size, v.color, v.stock_quantity
      FROM product_variants v
      JOIN products p ON p.id = v.product_id
     WHERE p.is_active = 1 AND v.stock_quantity <= ?
     ORDER BY v.stock_quantity ASC, p.name ASC
     LIMIT 8
  `, threshold);

  const lowStockCount = one(
    `SELECT COUNT(*) AS c
       FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.is_active = 1 AND v.stock_quantity <= ?`,
    threshold
  ).c;

  const ordersByStatus = all(`
    SELECT order_status AS status, COUNT(*) AS count
      FROM orders GROUP BY order_status
  `);

  return {
    ...totals,
    ...revenue,
    recentOrders,
    lowStock,
    lowStockCount,
    ordersByStatus,
    lowStockThreshold: threshold,
  };
}
