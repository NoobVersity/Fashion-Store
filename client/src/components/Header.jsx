import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useCustomerAuth } from '../context/CustomerAuthContext.jsx';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

/**
 * Public storefront header. NOTE: intentionally contains no admin
 * link — the admin area is reachable only by typing /admin/login.
 */
export default function Header() {
  const { count } = useCart();
  const { customer } = useCustomerAuth();

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="THREADS home">
          <Logo size={26} />
          <span>THREADS</span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-link" to="/catalog">
            Shop
          </Link>
          <Link className="nav-link" to="/catalog?sort=newest">
            New In
          </Link>
          <Link className="nav-link" to="/catalog?category=accessories">
            Accessories
          </Link>
        </nav>

        <div className="header-actions">
          <Link className="nav-link" to="/account">
            {customer ? 'Account' : 'Sign in'}
          </Link>
          <ThemeToggle />
          <Link
            to="/cart"
            className="cart-link"
            aria-label={`Shopping cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M6 8h12l-1 12H7L6 8z" />
              <path d="M9 8V6a3 3 0 0 1 6 0v2" />
            </svg>
            <span className="cart-label">Cart</span>
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
