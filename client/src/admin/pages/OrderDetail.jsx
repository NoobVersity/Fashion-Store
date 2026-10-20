import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDateTime, ORDER_STATUS } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';

const TRANSITIONS = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Single order: customer/shipping details, snapshot items, status controls. */
export default function OrderDetail() {
  const { id } = useParams();
  const { money } = useSettings();
  const { toast } = useToast();

  const [state, setState] = useState({ loading: true, error: null, order: null });
  const [changing, setChanging] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, busy: false });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get(`/admin/orders/${id}`)
      .then((data) => setState({ loading: false, error: null, order: data.order }))
      .catch((err) => setState({ loading: false, error: err.message, order: null }));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (next) => {
    setChanging(true);
    try {
      const data = await api.patch(`/admin/orders/${id}/status`, { status: next });
      setState((prev) => ({ ...prev, order: data.order }));
      toast.success(`Order ${data.order.order_number} → ${ORDER_STATUS[next] || next}`);
      if (next === 'cancelled') load(); // stock numbers may have changed
    } catch (err) {
      toast.error(err.message);
      load();
    } finally {
      setChanging(false);
    }
  };

  const cancelOrder = async () => {
    setConfirm((prev) => ({ ...prev, busy: true }));
    await changeStatus('cancelled');
    setConfirm({ open: false, busy: false });
  };

  if (state.loading) return <Loader label="Loading order…" />;
  if (state.error || !state.order) {
    return (
      <>
        <Link className="back-link" to="/admin/orders">
          ← Back to orders
        </Link>
        <ErrorState title="Order not found" error={state.error} onRetry={load} />
      </>
    );
  }

  const order = state.order;
  const nextStatuses = order.allowed_next || TRANSITIONS[order.order_status] || [];
  const cancellable =
    nextStatuses.includes('cancelled') ||
    order.order_status === 'pending' ||
    order.order_status === 'processing';

  return (
    <>
      <Link className="back-link" to="/admin/orders">
        ← Back to orders
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">{order.order_number}</h1>
          <p className="page-sub">Placed {formatDateTime(order.created_at)}</p>
        </div>
        <div className="page-actions row">
          <span className={`status-pill status-${order.order_status}`}>
            {ORDER_STATUS[order.order_status] || order.order_status}
          </span>
          {nextStatuses.length > 0 && (
            <select
              className="filter-select"
              aria-label="Change order status"
              value=""
              disabled={changing}
              onChange={(e) => {
                if (e.target.value) changeStatus(e.target.value);
              }}
            >
              <option value="">Change status…</option>
              {nextStatuses
                .filter((s) => s !== 'cancelled')
                .map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS[s] || s}
                  </option>
                ))}
            </select>
          )}
          {cancellable && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={changing}
              onClick={() => setConfirm({ open: true, busy: false })}
            >
              Cancel order
            </button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Customer</h3>
          </div>
          <div className="panel-body">
            <div className="detail-grid">
              <div className="kv">
                <div className="k">Name</div>
                <div className="v">{order.customer_name}</div>
              </div>
              <div className="kv">
                <div className="k">Email</div>
                <div className="v">{order.customer_email}</div>
              </div>
              <div className="kv">
                <div className="k">Phone</div>
                <div className="v">{order.customer_phone || '—'}</div>
              </div>
              <div className="kv">
                <div className="k">Order note</div>
                <div className="v">{order.order_note || '—'}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Shipping &amp; payment</h3>
          </div>
          <div className="panel-body">
            <div className="detail-grid">
              <div className="kv">
                <div className="k">Address</div>
                <div className="v">{order.shipping_address}</div>
              </div>
              <div className="kv">
                <div className="k">Payment method</div>
                <div className="v">Simulated (demo)</div>
              </div>
              <div className="kv">
                <div className="k">Payment status</div>
                <div className="v">{order.payment_status}</div>
              </div>
              <div className="kv">
                <div className="k">Stock restored</div>
                <div className="v">{order.stock_restored ? 'Yes' : 'No'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel mt-3">
        <div className="panel-head">
          <h3 className="panel-title">Items</h3>
        </div>
        <div className="panel-body flush">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th className="num">Unit price</th>
                  <th className="num">Qty</th>
                  <th className="num">Line total</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name_snapshot}</td>
                    <td className="muted">{item.variant_snapshot}</td>
                    <td className="num">{money(item.unit_price)}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{money(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '16px 20px', maxWidth: '360px', marginLeft: 'auto' }}>
            <div className="summary-line row-between">
              <span>Subtotal</span>
              <span>{money(order.subtotal)}</span>
            </div>
            {order.discount_amount > 0 && (
              <div className="summary-line row-between">
                <span>Discount {order.discount_code ? `(${order.discount_code})` : ''}</span>
                <span>−{money(order.discount_amount)}</span>
              </div>
            )}
            <div className="summary-total row-between">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm.open}
        title="Cancel this order?"
        message="The order will be marked cancelled and the reserved stock will be returned to inventory exactly once. This cannot be undone."
        confirmLabel="Cancel order"
        danger
        busy={confirm.busy}
        onConfirm={cancelOrder}
        onCancel={() => setConfirm({ open: false, busy: false })}
      />
    </>
  );
}
