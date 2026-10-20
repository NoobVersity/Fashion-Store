import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container not-found">
      <div className="code">404</div>
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist or has moved.</p>
      <div className="row" style={{ justifyContent: 'center', marginTop: '20px' }}>
        <Link className="btn" to="/">
          Back to home
        </Link>
        <Link className="btn btn-outline" to="/catalog">
          Browse catalog
        </Link>
      </div>
    </div>
  );
}
