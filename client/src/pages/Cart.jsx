import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import api from '../services/api.js';
import EmptyState from '../components/EmptyState.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';

const DISCOUNT_KEY = 'threads_discount';

export default function Cart() {
  const { items, subtotal, updateQuantity, removeItem, lineKey } = useCart();
  const { money } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [codeInput, setCodeInput] = useState('');
  const [applied, setApplied] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISCOUNT_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [message, setMessage] = useState(null); // {type:'ok'|'bad', text}
  const [checking, setChecking] = useState(false);

  // Keep the stored discount in sync with the current subtotal.
  useEffect(() => {
    if (!applied) return;
    if (subtotal < 1) {
      setApplied(null);
      sessionStorage.removeItem(DISCOUNT_KEY);
      return;
    }
    setChecking(true);
    api
      .post('/discounts/validate', { code: applied.code, subtotal })
      .then((data) => {
        const fresh = { ...applied, discount_amount: data.discount_amount };
        setApplied(fresh);
        sessionStorage.setItem(DISCOUNT_KEY, JSON.stringify(fresh));
      })
      .catch(() => {
        // Minimum no longer met or code removed — drop it.
        setApplied(null);
        sessionStorage.removeItem(DISCOUNT_KEY);
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  const applyCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setChecking(true);
    setMessage(null);
    try {
      const data = await api.post('/discounts/validate', { code, subtotal });
      const record = {
        code: data.code,
        discount_type: data.discount_type,
        discount_value: data.discount_value,
        discount_amount: data.discount_amount,
      };
      setApplied(record);
      sessionStorage.setItem(DISCOUNT_KEY, JSON.stringify(record));
      setCodeInput('');
      setMessage({ type: 'ok', text: `Code applied — you save ${money(data.discount_amount)}.` });
    } catch (err) {
      setApplied(null);
      sessionStorage.removeItem(DISCOUNT_KEY);
      setMessage({ type: 'bad', text: err.message });
    } finally {
      setChecking(false);
    }
  };

  const removeDiscount = () => {
    setApplied(null);
    sessionStorage.removeItem(DISCOUNT_KEY);
    setMessage(null);
    toast.info('Discount code removed.');
  };

  if (items.length === 0) {
    return (
      <div className="container cart-page">
        <h1 className="page-title">Your cart</h1>
        <EmptyState
          title="Your cart is empty"
          message="Browse the catalog and add something you love."
          action={
            <Link className="btn btn-accent" to="/catalog">
              Shop the collection
            </Link>
          }
        />
      </div>
    );
  }

  const discountAmount = applied ? Math.min(applied.discount_amount, subtotal) : 0;
  const total = subtotal - discountAmount;

  return (
    <div className="container cart-page">
      <div className="page-head" style={{ background: 'transparent', border: 0, padding: '0 0 20px' }}>
        <h1 className="page-title">Your cart</h1>
        <p className="muted small mb-0">{items.length} item{items.length === 1 ? '' : 's'}</p>
      </div>

      <div className="cart-layout">
        <div>
          <table className="cart-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Price</th>
                <th>Quantity</th>
                <th className="text-right">Total</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const key = lineKey(item);
                return (
                  <tr key={key}>
                    <td>
                      <div className="cart-item-cell">
                        <ProductImage src={item.image_path} alt={item.name} />
                        <div>
                          <Link className="cart-item-name" to={`/product/${item.slug}`}>
                            {item.name}
                          </Link>
                          <div className="cart-item-variant">
                            {item.size} / {item.color}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{money(item.price)}</td>
                    <td>
                      <QuantityStepper
                        value={item.quantity}
                        min={1}
                        max={item.maxStock}
                        onChange={(q) => updateQuantity(key, q)}
                      />
                      {item.quantity >= item.maxStock && (
                        <div className="muted small">Max stock: {item.maxStock}</div>
                      )}
                    </td>
                    <td className="text-right">
                      <span className="line-price">{money(item.price * item.quantity)}</span>
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeItem(key)}
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="summary-card">
          <h3>Order summary</h3>
          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {applied && (
            <div className="summary-line">
              <span>
                Discount <strong>{applied.code}</strong>
              </span>
              <span>−{money(discountAmount)}</span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <div className="discount-row">
            <input
              type="text"
              placeholder="DISCOUNT CODE"
              aria-label="Discount code"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && applyCode()}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={applyCode}
              disabled={checking}
            >
              {checking ? '…' : 'Apply'}
            </button>
          </div>
          {message && <p className={`discount-msg ${message.type}`}>{message.text}</p>}
          {applied && !message && (
            <p className="discount-msg ok row-between">
              <span>Code {applied.code} applied.</span>
              <button type="button" className="remove-btn" onClick={removeDiscount}>
                Remove
              </button>
            </p>
          )}

          <p className="demo-notice">
            <span aria-hidden="true">ⓘ</span>
            <span>
              This is a demo store. Checkout is simulated and no payment is ever
              taken.
            </span>
          </p>

          <button
            type="button"
            className="btn btn-accent btn-block"
            onClick={() => navigate('/checkout')}
          >
            Continue to checkout
          </button>
          <div className="text-right mt-2">
            <Link className="muted small" to="/catalog">
              ← Continue shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
