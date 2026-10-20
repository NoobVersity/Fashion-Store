import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import FormField from '../components/FormField.jsx';

/** Customer sign-in. */
export default function Login() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state && location.state.from) || '/account';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Access your orders and faster checkout.</p>
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={setField('email')}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={setField('password')}
        />
        <button className="btn btn-accent btn-block" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-alt">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
