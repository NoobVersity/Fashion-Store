import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './AdminAuthProvider.jsx';
import { useToast, ToastViewport } from '../context/ToastContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ScrollToTop from '../components/ScrollToTop.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import '../styles/admin.css';

/* Minimal 24x24 stroke icons (no icon library needed). */
const ICONS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
    </>
  ),
  products: (
    <>
      <path d="M20.6 13.4 12 4.8H4.8V12l8.6 8.6a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8Z" />
      <circle cx="8.6" cy="8.6" r="1.4" />
    </>
  ),
  categories: (
    <>
      <path d="m12 3 9 4.8-9 4.8-9-4.8L12 3Z" />
      <path d="m3 12.5 9 4.8 9-4.8" />
      <path d="m3 16.8 9 4.8 9-4.8" />
    </>
  ),
  orders: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.2 20c.4-3.3 2.9-5.6 5.8-5.6s5.4 2.3 5.8 5.6" />
      <path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 20c-.2-1.7-.8-3.2-1.7-4.3 2.6.3 4.6 2.4 5 5.1" />
    </>
  ),
  discounts: (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5V10a2 2 0 0 0 0 4v1.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5V14a2 2 0 0 0 0-4V8.5Z" />
      <path d="M14 6.5v11" strokeDasharray="2 3" />
    </>
  ),
  inventory: (
    <>
      <path d="m12 3 8 4.4v9.2L12 21l-8-4.4V7.4L12 3Z" />
      <path d="m4 7.4 8 4.4 8-4.4M12 11.8V21" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.3 12c0-.5-.1-1-.2-1.5l2-1.5-1.9-3.3-2.3 1a7.6 7.6 0 0 0-2.6-1.5L13.8 2.7h-3.6l-.5 2.5a7.6 7.6 0 0 0-2.6 1.5l-2.3-1L2.9 9l2 1.5a7.7 7.7 0 0 0 0 3l-2 1.5 1.9 3.3 2.3-1a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h3.6l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3 1 1.9-3.3-2-1.5c.1-.5.2-1 .2-1.5Z" />
    </>
  ),
};

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/products', label: 'Products', icon: 'products' },
  { to: '/admin/categories', label: 'Categories', icon: 'categories' },
  { to: '/admin/orders', label: 'Orders', icon: 'orders' },
  { to: '/admin/customers', label: 'Customers', icon: 'customers' },
  { to: '/admin/discounts', label: 'Discounts', icon: 'discounts' },
  { to: '/admin/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/admin/settings', label: 'Settings', icon: 'settings' },
];

function Icon({ name }) {
  return (
    <svg
      className="nav-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/** Section label for the top bar, derived from the current path. */
function currentTitle(pathname) {
  const seg = pathname.split('/')[2] || '';
  const base = seg.split('/')[0];
  const hit = NAV.find((n) => {
    const navSeg = n.to.split('/')[2] || '';
    return navSeg === base && base !== '';
  });
  if (!seg) return 'Dashboard';
  if (base === 'orders' && pathname.includes('/orders/')) return 'Order details';
  if (base === 'customers' && pathname.includes('/customers/')) return 'Customer details';
  return hit ? hit.label : 'Admin';
}

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    setBusy(true);
    try {
      await logout();
      navigate('/admin/login', { replace: true });
    } catch {
      toast.error('Logout failed. Please try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    setConfirming(false);
  };

  return (
    <div className="admin-shell">
      <ScrollToTop />

      <aside className={`admin-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-brand">
          <Logo size={20} fixed />
          <div>
            THREADS
            <span>Admin</span>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Admin navigation">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `sidebar-link${isActive ? ' active' : ''}`
              }
              onClick={() => setOpen(false)}
            >
              <Icon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Demo store · simulated payments</div>
      </aside>

      {open && (
        <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="topbar-title">{currentTitle(location.pathname)}</div>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link to="/admin/account" className="account-link">
              {admin?.email}
            </Link>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setConfirming(true)}
            >
              Log out
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Log out?"
        message="You will need to sign in again to access the admin area."
        confirmLabel="Log out"
        busy={busy}
        onConfirm={handleLogout}
        onCancel={() => setConfirming(false)}
      />
      <ToastViewport />
    </div>
  );
}
