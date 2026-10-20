import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import { useSettings } from '../context/SettingsContext.jsx';

export default function ProductCard({ product }) {
  const { money, settings } = useSettings();
  const threshold = Number(settings.low_stock_threshold) || 5;
  const out = !product.in_stock;
  const low = !out && product.total_stock <= threshold;

  return (
    <Link className="product-card" to={`/product/${product.slug}`}>
      <div className="product-media">
        <ProductImage src={product.image_path} alt={product.name} />
        {out && <span className="stock-flag flag-out">Sold out</span>}
        {low && (
          <span className="stock-flag flag-low">
            Only {product.total_stock} left
          </span>
        )}
      </div>
      <div className="product-info">
        <span className="product-category">{product.category?.name}</span>
        <h3 className="product-name">{product.name}</h3>
        <div className="product-meta">
          <span className="product-price">{money(product.price)}</span>
          {!out && product.sizes?.length > 0 && (
            <span className="product-sizes">{product.sizes.join(' · ')}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
