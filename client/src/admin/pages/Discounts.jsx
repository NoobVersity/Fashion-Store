import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { formatDate } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import FormField from '../../components/FormField.jsx';

const EMPTY_FORM = {
  code: '',
  discount_type: 'percentage',
  discount_value: '',
  minimum_order_value: '',
  starts_at: '',
  expires_at: '',
  usage_limit: '',
  is_active: true,
  description: '',
};

/** to <input type="datetime-local"> and back. */
const isoToLocal = (iso) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');
const localToIso = (v) => (v ? new Date(v).toISOString() : null);

/** Discount code CRUD with usage protection (used codes cannot be deleted). */
export default function Discounts() {
  const { money } = useSettings();
  const { toast } = useToast();

  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, editing: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, discount: null, busy: false });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    api
      .get(`/admin/discounts${query}`)
      .then((data) => setState({ loading: false, error: null, items: data.items }))
      .catch((err) => setState({ loading: false, error: err.message, items: [] }));
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (d) => {
    setForm({
      code: d.code,
      discount_type: d.discount_type,
      discount_value:
        d.discount_type === 'percentage'
          ? String(d.discount_value)
          : (d.discount_value / 100).toFixed(2),
      minimum_order_value: d.minimum_order_value ? (d.minimum_order_value / 100).toFixed(2) : '',
      starts_at: isoToLocal(d.starts_at),
      expires_at: isoToLocal(d.expires_at),
      usage_limit: d.usage_limit == null ? '' : String(d.usage_limit),
      is_active: Boolean(d.is_active),
      description: d.description || '',
    });
    setErrors({});
    setModal({ open: true, editing: d });
  };

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^[A-Za-z0-9_-]{3,32}$/.test(form.code.trim()))
      next.code = '3–32 characters: letters, numbers, - or _.';
    const value = Number(form.discount_value);
    if (!Number.isFinite(value) || value <= 0) next.discount_value = 'Enter a value greater than 0.';
    if (form.discount_type === 'percentage' && value > 100)
      next.discount_value = 'Percentage must be 1–100.';
    if (form.starts_at && form.expires_at && new Date(form.starts_at) >= new Date(form.expires_at))
      next.expires_at = 'Expiry must be after the start date.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const body = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value:
        form.discount_type === 'percentage'
          ? Math.round(value)
          : Math.round(parseFloat(form.discount_value) * 100),
      minimum_order_value: form.minimum_order_value
        ? Math.round(parseFloat(form.minimum_order_value) * 100)
        : 0,
      starts_at: localToIso(form.starts_at),
      expires_at: localToIso(form.expires_at),
      usage_limit: form.usage_limit === '' ? null : Math.max(1, parseInt(form.usage_limit, 10) || 1),
      is_active: form.is_active,
      description: form.description.trim(),
    };

    setSaving(true);
    try {
      if (modal.editing) {
        await api.put(`/admin/discounts/${modal.editing.id}`, body);
        toast.success('Discount updated');
      } else {
        await api.post('/admin/discounts', body);
        toast.success('Discount created');
      }
      setModal({ open: false, editing: null });
      load();
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      } else {
        setErrors({ code: err.message });
      }
      if (err.status === 409) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (d) => {
    try {
      await api.patch(`/admin/discounts/${d.id}/status`, { is_active: !d.is_active });
      toast.success(`Code ${d.code} ${d.is_active ? 'deactivated' : 'activated'}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setConfirm((prev) => ({ ...prev, busy: true }));
    try {
      await api.delete(`/admin/discounts/${confirm.discount.id}`);
      toast.success('Discount deleted');
      setConfirm({ open: false, discount: null, busy: false });
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm({ open: false, discount: null, busy: false });
    }
  };

  const isExpired = (d) => d.expires_at && new Date(d.expires_at) < new Date();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Discounts</h1>
          <p className="page-sub">{state.items.length} code{state.items.length === 1 ? '' : 's'}.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New discount
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search codes…"
            aria-label="Search discount codes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {state.loading && <Loader label="Loading discounts…" />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={load} />}
        {!state.loading && !state.error && state.items.length === 0 && (
          <EmptyState
            title="No discount codes"
            message="Create a code shoppers can enter in the cart."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                New discount
              </button>
            }
          />
        )}

        {!state.loading && !state.error && state.items.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Value</th>
                  <th className="num">Min. order</th>
                  <th>Window</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div>{d.code}</div>
                      {d.description && <div className="cell-sub">{d.description}</div>}
                    </td>
                    <td>
                      {d.discount_type === 'percentage'
                        ? `${d.discount_value}%`
                        : money(d.discount_value)}
                    </td>
                    <td className="num">
                      {d.minimum_order_value ? money(d.minimum_order_value) : '—'}
                    </td>
                    <td className="muted small">
                      {formatDate(d.starts_at)} → {d.expires_at ? formatDate(d.expires_at) : 'No expiry'}
                    </td>
                    <td>
                      {d.usage_count} / {d.usage_limit ?? '∞'}
                    </td>
                    <td>
                      {isExpired(d) ? (
                        <span className="status-pill status-cancelled">Expired</span>
                      ) : (
                        <span
                          className={`status-pill ${d.is_active ? 'status-active' : 'status-inactive'}`}
                        >
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn primary"
                          title="Edit code"
                          aria-label={`Edit ${d.code}`}
                          onClick={() => openEdit(d)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={d.is_active ? 'Deactivate' : 'Activate'}
                          aria-label={`${d.is_active ? 'Deactivate' : 'Activate'} ${d.code}`}
                          onClick={() => toggleStatus(d)}
                        >
                          {d.is_active ? '⏻' : '✓'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete code"
                          aria-label={`Delete ${d.code}`}
                          onClick={() => setConfirm({ open: true, discount: d, busy: false })}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modal.open}
        title={modal.editing ? `Edit — ${modal.editing.code}` : 'New discount'}
        size="lg"
        onClose={saving ? undefined : () => setModal({ open: false, editing: null })}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setModal({ open: false, editing: null })}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="discount-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.editing ? 'Save changes' : 'Create discount'}
            </button>
          </>
        }
      >
        <form id="discount-form" className="admin-form" onSubmit={save} noValidate>
          <div className="form-grid-2">
            <FormField
              label="Code"
              name="code"
              required
              value={form.code}
              onChange={(v) => setField('code')(v.toUpperCase())}
              error={errors.code}
              hint="Shown to shoppers at checkout."
            />
            <FormField
              label="Type"
              name="discount_type"
              as="select"
              value={form.discount_type}
              onChange={(v) => {
                setField('discount_type')(v);
                setField('discount_value')('');
              }}
              options={[
                { value: 'percentage', label: 'Percentage (%)' },
                { value: 'fixed', label: 'Fixed amount' },
              ]}
            />
            <FormField
              label={form.discount_type === 'percentage' ? 'Percentage' : 'Amount (USD)'}
              name="discount_value"
              type="number"
              min="0"
              step={form.discount_type === 'percentage' ? '1' : '0.01'}
              required
              value={form.discount_value}
              onChange={setField('discount_value')}
              error={errors.discount_value}
              hint={form.discount_type === 'percentage' ? '1–100' : 'Deducted from the subtotal.'}
            />
            <FormField
              label="Minimum order (USD)"
              name="minimum_order_value"
              type="number"
              min="0"
              step="0.01"
              value={form.minimum_order_value}
              onChange={setField('minimum_order_value')}
              error={errors.minimum_order_value}
              hint="Leave empty for no minimum."
            />
            <FormField
              label="Starts at"
              name="starts_at"
              type="datetime-local"
              value={form.starts_at}
              onChange={setField('starts_at')}
              error={errors.starts_at}
            />
            <FormField
              label="Expires at"
              name="expires_at"
              type="datetime-local"
              value={form.expires_at}
              onChange={setField('expires_at')}
              error={errors.expires_at}
              hint="Leave empty for no expiry."
            />
            <FormField
              label="Usage limit"
              name="usage_limit"
              type="number"
              min="1"
              value={form.usage_limit}
              onChange={setField('usage_limit')}
              error={errors.usage_limit}
              hint="Leave empty for unlimited uses."
            />
            <div className="field">
              <label>Status</label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active')(e.target.checked)}
                />
                Active (accept the code)
              </label>
            </div>
          </div>
          <FormField
            label="Description"
            name="description"
            as="textarea"
            value={form.description}
            onChange={setField('description')}
            error={errors.description}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        title="Delete discount?"
        message={
          confirm.discount
            ? `Code ${confirm.discount.code} will be deleted. Codes that have already been used cannot be removed — deactivate them instead.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={confirm.busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm({ open: false, discount: null, busy: false })}
      />
    </>
  );
}
