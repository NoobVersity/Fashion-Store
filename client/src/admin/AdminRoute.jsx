import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthProvider.jsx';

/**
 * UX-only guard: unauthenticated visitors are redirected to
 * /admin/login. Every API endpoint independently verifies the session.
 */
export default function AdminRoute({ children }) {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="admin-splash">
        <div className="spinner" />
        <p className="muted small mt-2">Checking session…</p>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
