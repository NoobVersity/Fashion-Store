import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, ORDER_STATUS } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import Pagination from '../../components/Pagination.jsx';

/** Order list with search, status filter and inline cancellation. */
export default function Orders() {
  const { money } = useSettings();
  const { toast } = useToast();

  const [list, setList] = useState({ loading: true, error: null, items: [], pagination: null });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [confirm, setConfirm] = useState({ open: false, order: null, busy: false });

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setList((prev) => ({ ...prev, loading: true, error: null }));
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (status) query.set('status', status);
    query.set('page', String(page));
    query.set('limit', '15');
    api
      .get(`/admin/orders?${query.toString()}`)
      .then((data) =>
        setList({ loading: false, error: null, items: data.items, pagination: data.pagination })
      )
      .catch((err) => setList({ loading: false, error: err.message, items: [], pagination: null }));
  }, [search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const cancelOrder = async () => {
    const order = confirm.order;
    setConfirm((prev) => ({ ...prev, busy: true }));
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status: 'cancelled' });
      toast.success(`Order ${order.order_number} cancelled — stock restored`);
      setConfirm({ open: false, order: null, busy: false });
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm({ open: false, order: null, busy: false });
      load();
    }
  };

  const total = list.pagination ? list.pagination.total : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="page-sub">{total} order{total === 1 ? '' : 's'} total.</p>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search order number or customer…"
            aria-label="Search orders"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {Object.entries(ORDER_STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {list.loading && <Loader label="Loading orders…" />}
        {!list.loading && list.error && <ErrorState error={list.error} onRetry={load} />}
        {!list.loading && !list.error && list.items.length === 0 && (
          <EmptyState
            title="No orders found"
            message={search || status ? 'Try a different search or filter.' : 'Orders appear here after checkout.'}
          />
        )}

        {!list.loading && !list.error && list.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th className="num">Items</th>
                    <th className="num">Total</th>
                    <th>Payment</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                      </td>
                      <td>{formatDate(order.created_at)}</td>
                      <td>
                        <div>{order.customer_name}</div>
                        <div className="cell-sub">{order.customer_email}</div>
                      </td>
                      <td className="num">{order.item_count}</td>
                      <td className="num">{money(order.total)}</td>
                      <td>
                        <span className="badge badge-muted">Simulated</span>
                      </td>
                      <td>
                        <span className={`status-pill status-${order.order_status}`}>
                          {ORDER_STATUS[order.order_status] || order.order_status}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="icon-btn primary"
                            to={`/admin/orders/${order.id}`}
                            title="View order"
                            aria-label={`View order ${order.order_number}`}
                          >
                            →
                          </Link>
                          {(order.order_status === 'pending' ||
                            order.order_status === 'processing') && (
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Cancel order"
                              aria-label={`Cancel order ${order.order_number}`}
                              onClick={() => setConfirm({ open: true, order, busy: false })}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                Showing {list.items.length} of {total}
              </span>
              <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Cancel order?"
        message={
          confirm.order
            ? `Order ${confirm.order.order_number} will be cancelled and reserved stock will be returned to inventory. This cannot be undone.`
            : ''
        }
        confirmLabel="Cancel order"
        danger
        busy={confirm.busy}
        onConfirm={cancelOrder}
        onCancel={() => setConfirm({ open: false, order: null, busy: false })}
      />
    </>
  );
}
