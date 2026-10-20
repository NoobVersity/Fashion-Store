import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { formatDate } from '../../utils/format.js';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Pagination from '../../components/Pagination.jsx';

/** Customer directory derived from checkout records. */
export default function Customers() {
  const { money } = useSettings();
  const [list, setList] = useState({ loading: true, error: null, items: [], pagination: null });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(() => {
    setList((prev) => ({ ...prev, loading: true, error: null }));
    const query = new URLSearchParams();
    if (search) query.set('search', search);
    query.set('page', String(page));
    query.set('limit', '15');
    api
      .get(`/admin/customers?${query.toString()}`)
      .then((data) =>
        setList({ loading: false, error: null, items: data.items, pagination: data.pagination })
      )
      .catch((err) => setList({ loading: false, error: err.message, items: [], pagination: null }));
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const total = list.pagination ? list.pagination.total : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">{total} customer{total === 1 ? '' : 's'}.</p>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search name or email…"
            aria-label="Search customers"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {list.loading && <Loader label="Loading customers…" />}
        {!list.loading && list.error && <ErrorState error={list.error} onRetry={load} />}
        {!list.loading && !list.error && list.items.length === 0 && (
          <EmptyState
            title="No customers found"
            message={
              search
                ? 'Try a different search.'
                : 'Customers are created automatically at checkout.'
            }
          />
        )}

        {!list.loading && !list.error && list.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th className="num">Orders</th>
                    <th className="num">Total spent</th>
                    <th>Last order</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div>{customer.name}</div>
                        <div className="cell-sub">
                          {customer.email}
                          {customer.phone ? ` · ${customer.phone}` : ''}
                        </div>
                      </td>
                      <td className="num">{customer.order_count}</td>
                      <td className="num">{money(customer.total_spent)}</td>
                      <td>{formatDate(customer.last_order_at || customer.created_at)}</td>
                      <td>
                        <div className="row-actions">
                          <Link
                            className="icon-btn primary"
                            to={`/admin/customers/${customer.id}`}
                            title="View customer"
                            aria-label={`View ${customer.name}`}
                          >
                            →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-meta">
              <span>
                Showing {list.items.length} of {total}
              </span>
              <Pagination page={list.pagination.page} totalPages={list.pagination.totalPages} onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
