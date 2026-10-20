import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate, ORDER_STATUS } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import FormField from '../../components/FormField.jsx';

/** Customer profile: contact details, aggregates and order history. */
export default function CustomerDetail() {
  const { id } = useParams();
  const { money } = useSettings();
  const { toast } = useToast();

  const [state, setState] = useState({ loading: true, error: null, customer: null });
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get(`/admin/customers/${id}`)
      .then((data) => setState({ loading: false, error: null, customer: data.customer }))
      .catch((err) => setState({ loading: false, error: err.message, customer: null }));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = () => {
    const c = state.customer;
    setForm({ name: c.name || '', email: c.email || '', phone: c.phone || '' });
    setErrors({});
    setEditOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const data = await api.put(`/admin/customers/${id}`, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setState((prev) => ({ ...prev, customer: data.customer }));
      setEditOpen(false);
      toast.success('Customer updated');
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      } else {
        setErrors({ email: err.message });
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <Loader label="Loading customer…" />;
  if (state.error || !state.customer) {
    return (
      <>
        <Link className="back-link" to="/admin/customers">
          ← Back to customers
        </Link>
        <ErrorState title="Customer not found" error={state.error} onRetry={load} />
      </>
    );
  }

  const c = state.customer;

  return (
    <>
      <Link className="back-link" to="/admin/customers">
        ← Back to customers
      </Link>

      <div className="page-head">
        <div>
          <h1 className="page-title">{c.name}</h1>
          <p className="page-sub">{c.email}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-outline" onClick={openEdit}>
            Edit contact
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          <div className="detail-grid">
            <div className="kv">
              <div className="k">Email</div>
              <div className="v">{c.email}</div>
            </div>
            <div className="kv">
              <div className="k">Phone</div>
              <div className="v">{c.phone || '—'}</div>
            </div>
            <div className="kv">
              <div className="k">Customer since</div>
              <div className="v">{formatDate(c.created_at)}</div>
            </div>
            <div className="kv">
              <div className="k">Orders</div>
              <div className="v">{c.order_count}</div>
            </div>
            <div className="kv">
              <div className="k">Total spent</div>
              <div className="v">{money(c.total_spent)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel mt-3">
        <div className="panel-head">
          <h3 className="panel-title">Order history</h3>
        </div>
        <div className="panel-body flush">
          {c.orders.length === 0 ? (
            <EmptyState title="No orders yet" message="This customer has not ordered so far." />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th className="num">Items</th>
                    <th className="num">Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {c.orders.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <Link to={`/admin/orders/${order.id}`}>{order.order_number}</Link>
                      </td>
                      <td>{formatDate(order.created_at)}</td>
                      <td className="num">{order.item_count}</td>
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
          )}
        </div>
      </div>

      <Modal
        open={editOpen}
        title="Edit contact"
        onClose={saving ? undefined : () => setEditOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="customer-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </>
        }
      >
        <form id="customer-form" className="admin-form" onSubmit={save} noValidate>
          <FormField
            label="Name"
            name="name"
            required
            value={form.name}
            onChange={(v) => {
              setForm((prev) => ({ ...prev, name: v }));
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />
          <FormField
            label="Email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={(v) => {
              setForm((prev) => ({ ...prev, email: v }));
              setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            error={errors.email}
          />
          <FormField
            label="Phone"
            name="phone"
            type="tel"
            value={form.phone}
            onChange={(v) => setForm((prev) => ({ ...prev, phone: v }))}
            error={errors.phone}
          />
        </form>
      </Modal>
    </>
  );
}
