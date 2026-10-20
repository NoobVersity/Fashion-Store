import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { formatDate, ORDER_STATUS } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';

/** Store overview: headline numbers, recent orders and stock alerts. */
export default function Dashboard() {
  const { money } = useSettings();
  const [state, setState] = useState({ loading: true, error: null, stats: null });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get('/admin/dashboard/stats')
      .then((data) => setState({ loading: false, error: null, stats: data.stats }))
      .catch((err) => setState({ loading: false, error: err.message, stats: null }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.loading) return <Loader label="Loading dashboard…" />;
  if (state.error || !state.stats) {
    return <ErrorState error={state.error} onRetry={load} />;
  }

  const s = state.stats;
  const cards = [
    { label: 'Total products', value: s.totalProducts, hint: `${s.activeProducts} active` },
    { label: 'Total orders', value: s.totalOrders, hint: `${s.pendingOrders} pending` },
    { label: 'Total customers', value: s.totalCustomers },
    {
      label: 'Revenue — last 30 days',
      value: money(s.revenue30d),
      hint: `All time: ${money(s.revenueAllTime)}`,
    },
    {
      label: 'Low-stock variants',
      value: s.lowStockCount,
      hint: s.lowStockCount > 0 ? 'Needs attention' : 'Everything healthy',
      warn: s.lowStockCount > 0,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Store overview at a glance.</p>
        </div>
      </div>

      <div className="stat-grid">
        {cards.map((card) => (
          <div className="stat-card" key={card.label}>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
            {card.hint && (
              <div className={`stat-hint${card.warn ? ' warn' : ''}`}>{card.hint}</div>
            )}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Recent orders</h3>
            <Link className="btn btn-outline btn-sm" to="/admin/orders">
              View all
            </Link>
          </div>
          <div className="panel-body flush">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="table-empty">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                  {s.recentOrders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                      </td>
                      <td>{order.customer_name}</td>
                      <td>{formatDate(order.created_at)}</td>
                      <td className="num">{money(order.total)}</td>
                      <td>
                        <span className={`status-pill status-${order.order_status}`}>
                          {ORDER_STATUS[order.order_status] || order.order_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Low stock</h3>
              <Link className="btn btn-outline btn-sm" to="/admin/inventory">
                Inventory
              </Link>
            </div>
            <div className="panel-body">
              {s.lowStock.length === 0 ? (
                <p className="muted small mb-0">All variants are above the threshold.</p>
              ) : (
                <ul className="low-stock-list">
                  {s.lowStock.map((v) => (
                    <li key={v.variant_id}>
                      <span>
                        {v.product_name}
                        <span className="cell-sub">
                          {v.size} / {v.color}
                        </span>
                      </span>
                      <span className={v.stock_quantity === 0 ? 'badge badge-danger' : 'badge badge-warning'}>
                        {v.stock_quantity === 0 ? 'Out' : `${v.stock_quantity} left`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Orders by status</h3>
            </div>
            <div className="panel-body">
              {s.ordersByStatus.length === 0 ? (
                <p className="muted small mb-0">No orders yet.</p>
              ) : (
                <ul className="low-stock-list">
                  {s.ordersByStatus.map((row) => (
                    <li key={row.status}>
                      <span className={`status-pill status-${row.status}`}>
                        {ORDER_STATUS[row.status] || row.status}
                      </span>
                      <span>{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
