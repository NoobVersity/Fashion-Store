import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import api from '../services/api.js';
import EmptyState from '../components/EmptyState.jsx';
import FormField from '../components/FormField.jsx';

const DISCOUNT_KEY = 'threads_discount';
const ORDER_KEY = 'threads_last_order';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart();
  const { money } = useSettings();
  const { customer } = useCustomerAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', phone: '', shipping_address: '', order_note: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(DISCOUNT_KEY)) || null;
    } catch {
      return null;
    }
  });

  // One idempotency token per checkout attempt: a double click cannot
  // create a second order.
  const tokenRef = useRef(null);
  if (!tokenRef.current) tokenRef.current = crypto.randomUUID();

  useEffect(() => {
    if (items.length === 0 && !submitting) {
      // Cart emptied (e.g. after a successful order) — nothing to do here.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Signed-in customers get their contact details prefilled.
  useEffect(() => {
    if (!customer) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || customer.name,
      email: prev.email || customer.email,
      phone: prev.phone || customer.phone,
    }));
  }, [customer]);

  if (items.length === 0) {
    return (
      <div className="container checkout-page">
        <h1 className="page-title">Checkout</h1>
        <EmptyState
          title="Your cart is empty"
          message="Add some products before checking out."
          action={
            <Link className="btn btn-accent" to="/catalog">
              Browse products
            </Link>
          }
        />
      </div>
    );
  }

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateClient = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (form.shipping_address.trim().length < 5) next.shipping_address = 'Please enter a shipping address.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const removeDiscount = () => {
    setApplied(null);
    sessionStorage.removeItem(DISCOUNT_KEY);
  };

  const discountAmount = applied ? Math.min(applied.discount_amount, subtotal) : 0;
  const total = subtotal - discountAmount;

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!validateClient()) return;

    setSubmitting(true);
    try {
      const order = await api.post('/checkout', {
        items: items.map((item) => ({
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
        },
        shipping_address: form.shipping_address.trim(),
        order_note: form.order_note.trim(),
        discount_code: applied ? applied.code : null,
        checkout_token: tokenRef.current,
      });
      sessionStorage.setItem(ORDER_KEY, JSON.stringify(order.order));
      sessionStorage.removeItem(DISCOUNT_KEY);
      clearCart();
      navigate('/order-confirmation');
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      }
      setFormError(err.message);
      if (err.status === 409) tokenRef.current = crypto.randomUUID(); // new attempt → new token
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container checkout-page">
      <div className="page-head" style={{ background: 'transparent', border: 0, padding: '0 0 20px' }}>
        <h1 className="page-title">Checkout</h1>
        <p className="muted small mb-0">Demo order — no payment is processed.</p>
      </div>

      <form className="checkout-layout" onSubmit={submit} noValidate>
        <div className="checkout-form">
          {formError && (
            <div className="form-error-summary" role="alert">
              {formError}{' '}
              {String(formError).toLowerCase().includes('stock') && (
                <Link to="/cart">Review your cart</Link>
              )}
            </div>
          )}

          <section className="form-section">
            <h3>Contact</h3>
            <FormField
              label="Full name"
              name="name"
              required
              autoComplete="name"
              value={form.name}
              onChange={setField('name')}
              error={errors.name}
            />
            <FormField
              label="Email address"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={setField('email')}
              error={errors.email}
              hint="Your order confirmation appears on the next page."
            />
            <FormField
              label="Phone (optional)"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={setField('phone')}
              error={errors.phone}
            />
          </section>

          <section className="form-section">
            <h3>Shipping</h3>
            <FormField
              label="Shipping address"
              name="shipping_address"
              as="textarea"
              required
              autoComplete="street-address"
              value={form.shipping_address}
              onChange={setField('shipping_address')}
              error={errors.shipping_address}
              hint="Street, city, postal code and country."
            />
            <FormField
              label="Order note (optional)"
              name="order_note"
              as="textarea"
              value={form.order_note}
              onChange={setField('order_note')}
              error={errors.order_note}
            />
          </section>
        </div>

        <div className="summary-card">
          <h3>Your order</h3>
          <div className="checkout-items">
            {items.map((item) => (
              <div className="checkout-item" key={`${item.productId}|${item.size}|${item.color}`}>
                <div>
                  <div>{item.name}</div>
                  <div className="muted">
                    {item.size} / {item.color} · Qty {item.quantity}
                  </div>
                </div>
                <div>{money(item.price * item.quantity)}</div>
              </div>
            ))}
          </div>

          <div className="summary-line">
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </div>
          {applied && (
            <div className="summary-line row-between">
              <span>
                Discount <strong>{applied.code}</strong>
              </span>
              <span className="row">
                <span>−{money(discountAmount)}</span>
                <button type="button" className="remove-btn" onClick={removeDiscount}>
                  Remove
                </button>
              </span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          <p className="demo-notice">
            <span aria-hidden="true">ⓘ</span>
            <span>
              <strong>Demo checkout.</strong> Payment is simulated — no card
              details are collected and no money is charged.
            </span>
          </p>

          <button type="submit" className="btn btn-accent btn-block" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order — ${money(total)}`}
          </button>
          <div className="text-right mt-2">
            <Link className="muted small" to="/cart">
              ← Back to cart
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
