import { useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import FormField from '../../components/FormField.jsx';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Public store settings (display only — no secrets live here). */
export default function Settings() {
  const { toast } = useToast();
  const [state, setState] = useState({ loading: true, error: null, settings: null });
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get('/admin/settings')
      .then((data) => {
        setState({ loading: false, error: null, settings: data.settings });
        setForm({
          store_name: data.settings.store_name || '',
          contact_email: data.settings.contact_email || '',
          contact_phone: data.settings.contact_phone || '',
          currency: data.settings.currency || 'USD',
          currency_symbol: data.settings.currency_symbol || '$',
          low_stock_threshold: String(data.settings.low_stock_threshold ?? '5'),
          store_description: data.settings.store_description || '',
        });
      })
      .catch((err) => setState({ loading: false, error: err.message, settings: null }));
  };

  useEffect(() => {
    load();
  }, []);

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.store_name.trim().length < 2) next.store_name = 'Store name is required.';
    if (!EMAIL_RE.test(form.contact_email.trim())) next.contact_email = 'Enter a valid email.';
    if (!/^[A-Za-z]{3}$/.test(form.currency.trim())) next.currency = 'ISO code, e.g. USD.';
    if (form.currency_symbol.trim().length < 1 || form.currency_symbol.length > 5)
      next.currency_symbol = '1–5 characters.';
    const threshold = Number(form.low_stock_threshold);
    if (!Number.isInteger(threshold) || threshold < 0)
      next.low_stock_threshold = 'A whole number of 0 or more.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const data = await api.put('/admin/settings', {
        store_name: form.store_name.trim(),
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim(),
        currency: form.currency.trim().toUpperCase(),
        currency_symbol: form.currency_symbol.trim(),
        low_stock_threshold: threshold,
        store_description: form.store_description.trim(),
      });
      setState((prev) => ({ ...prev, settings: data.settings }));
      toast.success('Settings saved');
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
        toast.error('Please fix the highlighted fields.');
      } else {
        toast.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <Loader label="Loading settings…" />;
  if (state.error || !form) return <ErrorState error={state.error} onRetry={load} />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Store settings</h1>
          <p className="page-sub">Public display configuration for the storefront.</p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: '820px' }}>
        <div className="panel-body">
          <form className="admin-form" onSubmit={save} noValidate>
            <div className="form-grid-2">
              <FormField
                label="Store name"
                name="store_name"
                required
                value={form.store_name}
                onChange={setField('store_name')}
                error={errors.store_name}
              />
              <FormField
                label="Contact email"
                name="contact_email"
                type="email"
                required
                value={form.contact_email}
                onChange={setField('contact_email')}
                error={errors.contact_email}
              />
              <FormField
                label="Contact phone"
                name="contact_phone"
                type="tel"
                value={form.contact_phone}
                onChange={setField('contact_phone')}
                error={errors.contact_phone}
              />
              <FormField
                label="Low-stock threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                required
                value={form.low_stock_threshold}
                onChange={setField('low_stock_threshold')}
                error={errors.low_stock_threshold}
                hint="Variants at or below this stock are flagged."
              />
              <FormField
                label="Currency"
                name="currency"
                required
                value={form.currency}
                onChange={(v) => setField('currency')(v.toUpperCase())}
                error={errors.currency}
                hint="ISO code, e.g. USD"
              />
              <FormField
                label="Currency symbol"
                name="currency_symbol"
                required
                value={form.currency_symbol}
                onChange={setField('currency_symbol')}
                error={errors.currency_symbol}
                hint="Max 5 characters."
              />
            </div>
            <FormField
              label="Store description"
              name="store_description"
              as="textarea"
              value={form.store_description}
              onChange={setField('store_description')}
              error={errors.store_description}
            />

            <div className="row mt-3">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
              <span className="muted small">
                Public display settings only — secrets are never shown here.
              </span>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
