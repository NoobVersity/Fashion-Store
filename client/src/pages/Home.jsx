import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';
import ProductCard from '../components/ProductCard.jsx';
import ProductImage from '../components/ProductImage.jsx';

export default function Home() {
  const [featured, setFeatured] = useState({ loading: true, error: null, items: [] });
  const [categories, setCategories] = useState({ loading: true, error: null, items: [] });

  useEffect(() => {
    let alive = true;
    api
      .get('/products?sort=newest&limit=8')
      .then((data) => alive && setFeatured({ loading: false, error: null, items: data.items }))
      .catch((err) => alive && setFeatured({ loading: false, error: err.message, items: [] }));
    api
      .get('/categories')
      .then((data) => alive && setCategories({ loading: false, error: null, items: data.categories }))
      .catch((err) => alive && setCategories({ loading: false, error: err.message, items: [] }));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div>
            <p className="eyebrow">New season · Autumn / Winter</p>
            <h1 className="hero-title display">
              Clothes that keep their shape — and their point of view.
            </h1>
            <p className="hero-text">
              THREADS is a small, considered wardrobe: honest fabrics, clean
              silhouettes and pieces you will still wear three years from now.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-accent" to="/catalog">
                Shop the collection
              </Link>
              <Link className="btn btn-outline" to="/catalog?sort=newest">
                New arrivals
              </Link>
            </div>
          </div>
        <figure className="hero-media">
          <ProductImage src="/images/hero.svg" alt="THREADS autumn editorial" />
          <figcaption className="hero-caption">The autumn edit</figcaption>
        </figure>
        </div>
      </section>

      {/* Brand intro */}
      <section className="section">
        <div className="container" style={{ maxWidth: '780px' }}>
          <p className="eyebrow">The brand</p>
          <h2 className="section-title">Fewer things, better made.</h2>
          <p className="lede">
            We design in small runs and keep the palette quiet — black, off
            white, warm greys and one terracotta accent. Every piece is cut to
            layer with the next, so a handful of garments covers a whole week.
          </p>
          <p className="muted">
            Orders are packed within two working days. This is a demonstration
            store: checkout is simulated and no payment is ever taken.
          </p>
          <Link className="btn btn-outline mt-2" to="/catalog">
            Browse all products
          </Link>
        </div>
      </section>

      {/* Categories */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Categories</p>
              <h2 className="section-title">Shop by category</h2>
            </div>
            <Link className="section-link" to="/catalog">
              View all
            </Link>
          </div>
          {categories.loading && <Loader />}
          {categories.error && <ErrorState error={categories.error} />}
          {!categories.loading && !categories.error && (
            <div className="category-grid">
              {categories.items.map((cat) => (
                <Link
                  key={cat.id}
                  className="category-tile"
                  to={`/catalog?category=${cat.slug}`}
                >
                  <span className="category-name">{cat.name}</span>
                  <span className="category-count">
                    {cat.product_count} product{cat.product_count === 1 ? '' : 's'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured products */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <div>
              <p className="eyebrow">Featured</p>
              <h2 className="section-title">New this week</h2>
            </div>
            <Link className="section-link" to="/catalog?sort=newest">
              View all
            </Link>
          </div>
          {featured.loading && <Loader />}
          {featured.error && <ErrorState error={featured.error} />}
          {!featured.loading && !featured.error && featured.items.length > 0 && (
            <div className="product-grid">
              {featured.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {!featured.loading && !featured.error && featured.items.length === 0 && (
            <p className="muted">No products available yet — check back soon.</p>
          )}
        </div>
      </section>
    </>
  );
}
