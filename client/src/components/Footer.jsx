import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext.jsx';

/**
 * Editorial footer: oversized serif wordmark, hairline dividers and
 * letterspaced links on the ink background.
 */
export default function Footer() {
  const { settings } = useSettings();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div className="footer-wordmark">{settings.store_name || 'THREADS'}</div>
          <p className="footer-tag">
            {settings.store_description ||
              'Clothing and accessories, curated — fewer things, better made.'}
          </p>
        </div>

        <div className="footer-grid">
          <div className="footer-col">
            <h4>Shop</h4>
            <Link to="/catalog">All products</Link>
            <Link to="/catalog?sort=newest">New in</Link>
            <Link to="/cart">Your cart</Link>
          </div>

          <div className="footer-col">
            <h4>Contact</h4>
            {settings.contact_email && (
              <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
            )}
            {settings.contact_phone && (
              <a href={`tel:${settings.contact_phone.replace(/[^+\d]/g, '')}`}>
                {settings.contact_phone}
              </a>
            )}
            <span className="footer-note">Mon–Fri, 9:00–18:00</span>
          </div>

          <div className="footer-col">
            <h4>The fine print</h4>
            <span className="footer-note">
              {settings.currency ? `Prices in ${settings.currency}` : 'Prices in USD'}
            </span>
            <span className="footer-note">
              Demo storefront — checkout is simulated and no real payment is
              taken.
            </span>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container row-between wrap">
          <span>
            © {new Date().getFullYear()} {settings.store_name || 'THREADS'}
          </span>
          <span>University MVP demo project</span>
        </div>
      </div>
    </footer>
  );
}
