import { Link } from 'react-router-dom';

export default function AdminNotFound() {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <div
        className="display"
        style={{ fontSize: '48px', lineHeight: 1, opacity: 0.25 }}
        aria-hidden="true"
      >
        404
      </div>
      <h2 className="mt-2 mb-0">Page not found</h2>
      <p className="muted mb-3">
        This admin page does not exist. Check the URL or go back to the
        dashboard.
      </p>
      <Link className="btn btn-accent" to="/admin">
        Back to dashboard
      </Link>
    </div>
  );
}
