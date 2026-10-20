import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';
import { formatDate, ORDER_STATUS } from '../utils/format.js';
import EmptyState from '../components/EmptyState.jsx';

const ORDER_KEY = 'threads_last_order';

export default function OrderConfirmation() {
  const { money } = useSettings();

  let order = null;
  try {
    order = JSON.parse(sessionStorage.getItem(ORDER_KEY));
  } catch {
    order = null;
  }

  if (!order) {
    return (
      <div className="container confirmation">
        <EmptyState
          title="No recent order to show"
          message="Order confirmations appear here right after a successful checkout."
          action={
            <Link className="btn btn-accent" to="/catalog">
              Continue shopping
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container confirmation">
      <div className="check" aria-hidden="true">✓</div>
      <p className="eyebrow">Order confirmed</p>
      <h1>Thank you, {order.customer_name.split(' ')[0]}.</h1>
      <p className="lede" style={{ margin: '0 auto' }}>
        Your demo order has been placed. In a real store we would email you a
        confirmation at {order.customer_email}.
      </p>
      <p className="order-number">Order {order.order_number}</p>

      <div className="confirmation-card">
        <div className="row-between wrap mb-3">
          <div className="kv">
            <div className="k">Placed</div>
            <div className="v">{formatDate(order.created_at)}</div>
          </div>
          <span className="badge badge-success">
            {ORDER_STATUS[order.order_status] || order.order_status}
          </span>
        </div>

        <table className="cart-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong>{item.product_name_snapshot}</strong>
                  <div className="cart-item-variant">{item.variant_snapshot}</div>
                </td>
                <td>{item.quantity}</td>
                <td className="text-right">{money(item.line_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-3">
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(order.subtotal)}</span>
          </div>
          {order.discount_amount > 0 && (
            <div className="summary-line">
              <span>Discount {order.discount_code ? `(${order.discount_code})` : ''}</span>
              <span>−{money(order.discount_amount)}</span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>{money(order.total)}</span>
          </div>
        </div>

        <div className="detail-facts mt-3">
          <div>
            <span className="k">Ship to</span>
            <span>{order.shipping_address}</span>
          </div>
          <div>
            <span className="k">Email</span>
            <span>{order.customer_email}</span>
          </div>
          <div>
            <span className="k">Payment</span>
            <span>Simulated — no charge was made.</span>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Link className="btn btn-accent" to="/catalog">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
