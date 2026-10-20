import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import FormField from '../components/FormField.jsx';

/** Customer registration. Guests can claim the email they checked out with. */
export default function Register() {
  const { register } = useCustomerAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key) => (value) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Please enter your name.';
    if (form.password.length < 8)
      next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
      navigate('/account', { replace: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      setFormError(err.message || 'Registration failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="container auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <h1 className="auth-title">Create account</h1>
        <p className="auth-sub">
          Saved details, order history and faster checkout.
        </p>
        {formError && (
          <div className="auth-error" role="alert">
            {formError}
          </div>
        )}
        <FormField
          label="Full name"
          name="name"
          autoComplete="name"
          required
          value={form.name}
          onChange={setField('name')}
          error={errors.name}
        />
        <FormField
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={setField('email')}
          error={errors.email}
        />
        <FormField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={setField('password')}
          error={errors.password}
          hint="At least 8 characters."
        />
        <button className="btn btn-accent btn-block" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create account'}
        </button>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
