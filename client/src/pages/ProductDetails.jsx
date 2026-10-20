import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api.js';
import { useSettings } from '../context/SettingsContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QuantityStepper from '../components/QuantityStepper.jsx';

export default function ProductDetails() {
  const { slug } = useParams();
  const { money, settings } = useSettings();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [state, setState] = useState({ loading: true, error: null, product: null });
  const [size, setSize] = useState(null);
  const [color, setColor] = useState(null);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, product: null });
    setSize(null);
    setColor(null);
    setQuantity(1);
    api
      .get(`/products/${slug}`)
      .then((data) => alive && setState({ loading: false, error: null, product: data.product }))
      .catch((err) => alive && setState({ loading: false, error: err.message, product: null }));
    return () => {
      alive = false;
    };
  }, [slug]);

  const product = state.product;
  const variants = product?.variants || [];
  const threshold = Number(settings.low_stock_threshold) || 5;

  // Sizes present on the product; a size is disabled when every variant
  // with that size is out of stock.
  const sizes = useMemo(() => {
    const map = new Map();
    variants.forEach((v) => map.set(v.size, (map.get(v.size) || 0) + v.stock_quantity));
    return [...map.entries()].map(([name, stock]) => ({ name, stock }));
  }, [variants]);

  // Colors available for the currently selected size.
  const colors = useMemo(() => {
    if (!size) return [];
    const map = new Map();
    variants
      .filter((v) => v.size === size)
      .forEach((v) => map.set(v.color, (map.get(v.color) || 0) + v.stock_quantity));
    return [...map.entries()].map(([name, stock]) => ({ name, stock }));
  }, [variants, size]);

  const selectedVariant = useMemo(
    () => (size && color ? variants.find((v) => v.size === size && v.color === color) : null),
    [variants, size, color]
  );
  const stock = selectedVariant ? selectedVariant.stock_quantity : 0;

  if (state.loading) {
    return (
      <div className="container">
        <Loader label="Loading product…" />
      </div>
    );
  }

  if (state.error || !product) {
    return (
      <div className="container">
        <ErrorState title="Product not found" error={state.error || 'This product does not exist.'} />
        <div className="text-right">
          <Link className="btn btn-outline btn-sm" to="/catalog">
            Back to catalog
          </Link>
        </div>
      </div>
    );
  }

  const isHex = (value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
  const stockNote =
    !selectedVariant
      ? null
      : stock === 0
        ? { cls: 'out', text: 'Out of stock' }
        : stock <= threshold
          ? { cls: 'low', text: `Only ${stock} left` }
          : { cls: 'in', text: 'In stock' };

  const handleAdd = () => {
    if (!selectedVariant || stock < 1) return;
    addItem(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image_path: product.image_path,
        category_name: product.category?.name,
      },
      { size, color, quantity }
    );
    toast.success(`${product.name} (${size} / ${color}) added to cart`);
  };

  return (
    <div className="container">
      <div className="page-head" style={{ background: 'transparent', border: 0, padding: '26px 0 0' }}>
        <p className="breadcrumbs" style={{ margin: 0 }}>
          <Link to="/">Home</Link> / <Link to="/catalog">Catalog</Link> / {product.name}
        </p>
      </div>

      <div className="product-page">
        <div className="product-gallery">
          <ProductImage
            src={product.image_path}
            alt={product.name}
            className="main-image"
          />
        </div>

        <div className="detail-info">
          <span className="detail-category">{product.category?.name}</span>
          <h1 className="detail-title">{product.name}</h1>
          <div className="detail-price">{money(product.price)}</div>
          {product.description && (
            <p className="detail-description">{product.description}</p>
          )}

          {/* Size */}
          <div className="variant-group">
            <div className="variant-label">
              <span>Size</span>
              {size && <span className="selected">Selected: {size}</span>}
            </div>
            {sizes.map((s) => (
              <button
                key={s.name}
                type="button"
                className={`size-btn${size === s.name ? ' active' : ''}`}
                disabled={s.stock === 0}
                aria-pressed={size === s.name}
                onClick={() => {
                  setSize(s.name);
                  setColor(null);
                  setQuantity(1);
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          {/* Color */}
          <div className="variant-group">
            <div className="variant-label">
              <span>Color</span>
              {color && <span className="selected">Selected: {color}</span>}
            </div>
            {!size && <p className="muted small">Select a size first.</p>}
            {size &&
              colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`color-btn${color === c.name ? ' active' : ''}`}
                  disabled={c.stock === 0}
                  aria-pressed={color === c.name}
                  onClick={() => {
                    setColor(c.name);
                    setQuantity(1);
                  }}
                >
                  {isHex(c.name) && (
                    <span className="color-swatch" style={{ background: c.name }} aria-hidden="true" />
                  )}
                  {c.name}
                </button>
              ))}
          </div>

          {stockNote && <p className={`stock-note ${stockNote.cls}`}>{stockNote.text}</p>}

          <div className="purchase-row">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              min={1}
              max={Math.max(1, stock)}
              disabled={!selectedVariant || stock === 0}
            />
            <button
              type="button"
              className="btn btn-accent"
              disabled={!selectedVariant || stock === 0}
              onClick={handleAdd}
            >
              Add to cart — {money(product.price * quantity)}
            </button>
          </div>

          <div className="detail-facts">
            <div>
              <span className="k">Category</span>
              <span>{product.category?.name}</span>
            </div>
            <div>
              <span className="k">Sizes</span>
              <span>{sizes.map((s) => s.name).join(', ')}</span>
            </div>
            <div>
              <span className="k">Colors</span>
              <span>
                {[...new Set(variants.map((v) => v.color))].join(', ')}
              </span>
            </div>
            <div>
              <span className="k">Availability</span>
              <span>
                {product.in_stock
                  ? `In stock — ${product.total_stock} unit${product.total_stock === 1 ? '' : 's'} across all variants`
                  : 'Currently out of stock'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
