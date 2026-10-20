import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../AdminAuthProvider.jsx';
import FormField from '../../components/FormField.jsx';
import '../../styles/admin.css';

/**
 * Admin sign-in. Sits outside the admin layout, so it imports the
 * admin stylesheet itself. The session cookie is HTTP-only; this form
 * only triggers POST /api/admin/auth/login.
 */
export default function AdminLogin() {
  const { admin, loading, login } = useAdminAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state && location.state.from) || '/admin';

  // Already signed in (or just signed in) → go to the requested page.
  if (!loading && admin) return <Navigate to={from} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      // <Navigate> renders as soon as auth state updates.
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">THREADS</div>
        <p className="login-sub">Admin access</p>

        {loading ? (
          <div style={{ padding: '28px 0', textAlign: 'center' }}>
            <div className="spinner" />
            <p className="muted small mt-2">Checking session…</p>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}
            <FormField
              label="Email address"
              name="email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={setEmail}
            />
            <FormField
              label="Password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
            />
            <button
              type="submit"
              className="btn btn-accent btn-block"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}

        <p className="login-note">
          Restricted area — authorization is verified on the server for every
          request.
        </p>
      </div>
    </div>
  );
}
