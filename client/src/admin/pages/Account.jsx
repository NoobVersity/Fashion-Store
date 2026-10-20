import { useState } from 'react';
import { useAdminAuth } from '../AdminAuthProvider.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import api from '../../services/api.js';
import FormField from '../../components/FormField.jsx';

/** Signed-in identity + password change form. */
export default function Account() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // {type, text}
  const [submitting, setSubmitting] = useState(false);

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setMessage(null);
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Enter your current password.';
    if (form.newPassword.length < 8) next.newPassword = 'At least 8 characters.';
    if (form.newPassword !== form.confirm) next.confirm = 'Passwords do not match.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await api.post('/admin/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage({
        type: 'success',
        text: 'Your password has been changed and your session refreshed.',
      });
      toast.success('Password changed');
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      }
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Account</h1>
          <p className="page-sub">Your administrator profile and password.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Profile</h3>
          </div>
          <div className="panel-body">
            <div className="detail-grid">
              <div className="kv">
                <div className="k">Signed in as</div>
                <div className="v">{admin?.email}</div>
              </div>
              <div className="kv">
                <div className="k">Role</div>
                <div className="v">Administrator</div>
              </div>
            </div>
            <p className="muted small mt-3 mb-0">
              Sessions are stored server-side; signing out invalidates the
              session immediately.
            </p>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3 className="panel-title">Change password</h3>
          </div>
          <div className="panel-body">
            {message && (
              <div className={`inline-alert ${message.type}`} role="alert">
                {message.text}
              </div>
            )}
            <form onSubmit={submit} noValidate className="admin-form">
              <FormField
                label="Current password"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={setField('currentPassword')}
                error={errors.currentPassword}
              />
              <FormField
                label="New password"
                name="newPassword"
                type="password"
                required
                autoComplete="new-password"
                value={form.newPassword}
                onChange={setField('newPassword')}
                error={errors.newPassword}
                hint="At least 8 characters."
              />
              <FormField
                label="Confirm new password"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={setField('confirm')}
                error={errors.confirm}
              />
              <button type="submit" className="btn btn-accent" disabled={submitting}>
                {submitting ? 'Saving…' : 'Change password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
