import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import Loader from '../components/Loader.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Sort: Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [result, setResult] = useState({ loading: true, error: null, items: [], pagination: null });
  const [categories, setCategories] = useState([]);

  const search = params.get('search') || '';
  const category = params.get('category') || '';
  const size = params.get('size') || '';
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;

  const [searchInput, setSearchInput] = useState(search);
  const [minInput, setMinInput] = useState(minPrice ? String(Number(minPrice) / 100) : '');
  const [maxInput, setMaxInput] = useState(maxPrice ? String(Number(maxPrice) / 100) : '');

  // Functional param updates avoid stale-closure bugs.
  const updateParams = (patch) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === '') next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    });
  };

  // Categories for the filter sidebar (once).
  useEffect(() => {
    let alive = true;
    api
      .get('/categories')
      .then((data) => alive && setCategories(data.categories))
      .catch(() => alive && setCategories([]));
    return () => {
      alive = false;
    };
  }, []);

  // Product query, synced to the URL.
  useEffect(() => {
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (category) query.set('category', category);
    if (size) query.set('size', size);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    query.set('sort', sort);
    query.set('page', String(page));
    query.set('limit', '12');

    let alive = true;
    setResult((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get(`/products?${query.toString()}`)
      .then((data) =>
        alive && setResult({ loading: false, error: null, items: data.items, pagination: data.pagination })
      )
      .catch((err) => alive && setResult({ loading: false, error: err.message, items: [], pagination: null }));
    return () => {
      alive = false;
    };
  }, [search, category, size, minPrice, maxPrice, sort, page]);

  // Debounced search box → URL.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) updateParams({ search: searchInput || null, page: null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const applyPrice = () => {
    const toCents = (v) => {
      const n = Math.round(parseFloat(v) * 100);
      return Number.isFinite(n) && n >= 0 ? String(n) : null;
    };
    updateParams({ minPrice: minInput ? toCents(minInput) : null, maxPrice: maxInput ? toCents(maxInput) : null, page: null });
  };

  const clearAll = () => {
    setSearchInput('');
    setMinInput('');
    setMaxInput('');
    setParams(new URLSearchParams());
  };

  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === category),
    [categories, category]
  );
  const total = result.pagination ? result.pagination.total : 0;

  return (
    <>
      <div className="page-head">
        <div className="container">
          <p className="breadcrumbs">
            <Link to="/">Home</Link> / Catalog
          </p>
          <h1 className="page-title">{activeCategory ? activeCategory.name : 'Catalog'}</h1>
          <p className="muted small mb-0">
            {result.loading ? 'Loading products…' : `${total} product${total === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      <div className="container catalog-layout">
        {/* ------------------------------------------------ filter sidebar */}
        <aside className="filters" aria-label="Product filters">
          <div className="filter-group">
            <h3 className="filter-title">Category</h3>
            <div className="filter-options">
              {categories.map((cat) => (
                <label key={cat.id} className="filter-option">
                  <input
                    type="checkbox"
                    checked={category === cat.slug}
                    onChange={(e) =>
                      updateParams({ category: e.target.checked ? cat.slug : null, page: null })
                    }
                  />
                  {cat.name}
                  <span className="muted small">({cat.product_count})</span>
                </label>
              ))}
              {categories.length === 0 && <span className="muted small">Loading…</span>}
            </div>
          </div>

          <div className="filter-group">
            <h3 className="filter-title">Size</h3>
            <div className="chip-row">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${size === s ? ' active' : ''}`}
                  aria-pressed={size === s}
                  onClick={() => updateParams({ size: size === s ? null : s, page: null })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <h3 className="filter-title">Price</h3>
            <div className="price-inputs">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Min"
                aria-label="Minimum price in dollars"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
              />
              <span aria-hidden="true">–</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Max"
                aria-label="Maximum price in dollars"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                onBlur={applyPrice}
                onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
              />
            </div>
          </div>

          <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
            Clear all filters
          </button>
        </aside>

        {/* --------------------------------------------------- product list */}
        <div>
          <div className="catalog-toolbar">
            <div className="search-bar">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search products…"
                aria-label="Search products"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <span className="result-count" aria-live="polite">
              {result.loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}
            </span>
            <select
              className="sort-select"
              aria-label="Sort products"
              value={sort}
              onChange={(e) => updateParams({ sort: e.target.value, page: null })}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {result.loading && <Loader label="Loading products…" />}
          {result.error && <ErrorState error={result.error} />}

          {!result.loading && !result.error && result.items.length === 0 && (
            <EmptyState
              title="No products match your filters"
              message="Try removing a filter or searching for something else."
              action={
                <button type="button" className="btn btn-outline btn-sm" onClick={clearAll}>
                  Clear all filters
                </button>
              }
            />
          )}

          {!result.loading && !result.error && result.items.length > 0 && (
            <>
              <div className="product-grid">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                onChange={(p) => updateParams({ page: p > 1 ? p : null })}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
