import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import FormField from '../components/FormField.jsx';
import api from '../services/api.js';

const STATUS_CLASS = {
  pending: 'st-pending',
  processing: 'st-processing',
  shipped: 'st-shipped',
  delivered: 'st-delivered',
  cancelled: 'st-cancelled',
};

/** Signed-in customer area: contact details + order history. */
export default function Account() {
  const { customer, loading, logout, updateProfile } = useCustomerAuth();
  const { money } = useSettings();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setProfile({ name: customer.name, phone: customer.phone || '' });
    }
  }, [customer]);

  useEffect(() => {
    if (!customer) return undefined;
    let cancelled = false;
    setOrdersLoading(true);
    api
      .get(`/auth/orders?page=${page}&limit=5`)
      .then((data) => {
        if (cancelled) return;
        setOrders((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
        setTotalPages(data.pagination.totalPages);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOrdersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer, page]);

  if (loading) {
    return (
      <div className="container account-page">
        <p className="muted">Loading your account…</p>
      </div>
    );
  }
  if (!customer) return <Navigate to="/login" state={{ from: '/account' }} replace />;

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaved(false);
    setProfileError(null);
    try {
      await updateProfile({
        name: profile.name.trim(),
        phone: profile.phone.trim(),
      });
      setSaved(true);
    } catch (err) {
      setProfileError(err.message || 'Could not save your details.');
    }
  };

  const signOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="container account-page">
      <div className="section-head">
        <div>
          <p className="eyebrow">My account</p>
          <h1 className="page-title">{customer.name}</h1>
          <p className="muted small">{customer.email}</p>
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={signOut}>
          Sign out
        </button>
      </div>

      <div className="account-grid">
        <form className="auth-card" onSubmit={saveProfile} noValidate>
          <h2 className="auth-title">Contact details</h2>
          {profileError && (
            <div className="auth-error" role="alert">
              {profileError}
            </div>
          )}
          {saved && <p className="muted small">Details saved.</p>}
          <FormField
            label="Full name"
            name="account-name"
            autoComplete="name"
            required
            value={profile.name}
            onChange={(v) => setProfile((p) => ({ ...p, name: v }))}
          />
          <FormField
            label="Email address"
            name="account-email"
            value={customer.email}
            onChange={() => {}}
            disabled
            hint="Your email cannot be changed in this demo."
          />
          <FormField
            label="Phone number"
            name="account-phone"
            autoComplete="tel"
            value={profile.phone}
            onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
          />
          <button className="btn btn-block">Save changes</button>
        </form>

        <div className="account-orders">
          <h2 className="auth-title">Order history</h2>
          {orders.length === 0 && !ordersLoading && (
            <p className="muted">
              No orders yet. <Link to="/catalog">Start shopping</Link>.
            </p>
          )}
          {orders.map((o) => (
            <article className="history-order" key={o.order_number}>
              <div className="history-head">
                <strong>{o.order_number}</strong>
                <span className={`status-tag ${STATUS_CLASS[o.order_status] || ''}`}>
                  {o.order_status}
                </span>
              </div>
              <p className="muted small">
                {new Date(o.created_at).toLocaleDateString()} ·{' '}
                {o.items.reduce((n, i) => n + i.quantity, 0)} item
                {o.items.reduce((n, i) => n + i.quantity, 0) === 1 ? '' : 's'}
              </p>
              <ul className="history-items">
                {o.items.map((i, idx) => (
                  <li key={idx}>
                    <span>
                      {i.name} · {i.variant} × {i.quantity}
                    </span>
                    <span>{money(i.line_total)}</span>
                  </li>
                ))}
              </ul>
              <div className="history-total">
                <span className="muted small">Total</span>
                <strong>{money(o.total)}</strong>
              </div>
            </article>
          ))}
          {ordersLoading && <p className="muted small">Loading…</p>}
          {!ordersLoading && page < totalPages && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setPage((p) => p + 1)}
            >
              Load more orders
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
