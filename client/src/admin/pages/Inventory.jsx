import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Pagination from '../../components/Pagination.jsx';

/**
 * Variant-level stock management: quick inline edits per row.
 * The threshold shown comes from the server settings.
 */
export default function Inventory() {
  const { toast } = useToast();

  const [state, setState] = useState({
    loading: true,
    error: null,
    items: [],
    pagination: null,
    threshold: 5,
  });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState({}); // variantId -> string value
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (filter !== 'all') query.set('filter', filter);
    query.set('page', String(page));
    query.set('limit', '20');
    api
      .get(`/admin/inventory?${query.toString()}`)
      .then((data) =>
        setState({
          loading: false,
          error: null,
          items: data.items,
          pagination: data.pagination,
          threshold: data.threshold,
        })
      )
      .catch((err) =>
        setState((prev) => ({ ...prev, loading: false, error: err.message, items: [] }))
      );
  }, [search, filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setDraft = (variantId, value) =>
    setDrafts((prev) => ({ ...prev, [variantId]: value }));

  const saveRow = async (item) => {
    const raw = drafts[item.variant_id];
    if (raw === undefined) return;
    const value = parseInt(raw, 10);
    if (!Number.isInteger(value) || value < 0) {
      toast.error('Stock must be a whole number of 0 or more.');
      return;
    }
    setSavingId(item.variant_id);
    try {
      const data = await api.patch(`/admin/inventory/${item.variant_id}`, {
        stock_quantity: value,
      });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[item.variant_id];
        return next;
      });
      toast.success(`${item.product_name} (${item.size} / ${item.color}) → ${value} units`);
      // Update the row in place without a full reload.
      setState((prev) => ({
        ...prev,
        items: prev.items.map((row) =>
          row.variant_id === item.variant_id
            ? { ...row, stock_quantity: data.variant.stock_quantity }
            : row
        ),
      }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  const threshold = Number(state.threshold) || 5;
  const total = state.pagination ? state.pagination.total : 0;

  const statusOf = (stock) =>
    stock === 0
      ? { cls: 'status-cancelled', label: 'Out' }
      : stock <= threshold
        ? { cls: 'status-pending', label: 'Low' }
        : { cls: 'status-active', label: 'In stock' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">Low-stock threshold: {threshold} units.</p>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search product…"
            aria-label="Search inventory"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by stock level"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All variants</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="in">In stock</option>
          </select>
        </div>

        {state.loading && <Loader label="Loading inventory…" />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={load} />}
        {!state.loading && !state.error && state.items.length === 0 && (
          <EmptyState
            title="No variants found"
            message={search || filter !== 'all' ? 'Try a different search or filter.' : 'Create products to see their stock here.'}
            action={
              <Link className="btn btn-outline btn-sm" to="/admin/products">
                Go to products
              </Link>
            }
          />
        )}

        {!state.loading && !state.error && state.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Status</th>
                    <th className="num">Stock</th>
                    <th>
                      <span className="sr-only">Save</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((item) => {
                    const status = statusOf(item.stock_quantity);
                    const draft = drafts[item.variant_id];
                    const changed = draft !== undefined && Number(draft) !== item.stock_quantity;
                    return (
                      <tr key={item.variant_id}>
                        <td>
                          <div>{item.product_name}</div>
                          <div className="cell-sub">{item.category_name}</div>
                        </td>
                        <td>
                          {item.size} / {item.color}
                        </td>
                        <td>
                          <span className={`status-pill ${status.cls}`}>{status.label}</span>
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            className="filter-select"
                            style={{ width: '96px' }}
                            aria-label={`Stock for ${item.product_name} ${item.size} ${item.color}`}
                            value={draft !== undefined ? draft : item.stock_quantity}
                            onChange={(e) => setDraft(item.variant_id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && changed) saveRow(item);
                            }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-btn primary"
                            title="Save stock"
                            aria-label={`Save stock for ${item.product_name} ${item.size} ${item.color}`}
                            disabled={!changed || savingId === item.variant_id}
                            onClick={() => saveRow(item)}
                          >
                            {savingId === item.variant_id ? '…' : '✓'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                Showing {state.items.length} of {total} variants
              </span>
              <Pagination page={state.pagination.page} totalPages={state.pagination.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
