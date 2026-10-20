import { Outlet } from 'react-router-dom';
import Header from './Header.jsx';
import Footer from './Footer.jsx';
import ScrollToTop from './ScrollToTop.jsx';
import { ToastViewport } from '../context/ToastContext.jsx';
import '../styles/storefront.css';

export default function StorefrontLayout() {
  return (
    <div className="storefront">
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Outlet />
      </main>
      <Footer />
      <ToastViewport />
    </div>
  );
}
