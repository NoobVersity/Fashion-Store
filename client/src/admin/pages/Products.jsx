import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import FormField from '../../components/FormField.jsx';
import Pagination from '../../components/Pagination.jsx';
import ProductImage from '../../components/ProductImage.jsx';

const EMPTY_FORM = {
  name: '',
  slug: '',
  description: '',
  price: '',
  category_id: '',
  image_path: '',
  is_active: true,
  variants: [{ size: 'M', color: 'Black', stock_quantity: 0 }],
};

/** Full product CRUD with the size/color/stock variant editor. */
export default function Products() {
  const { money } = useSettings();
  const { toast } = useToast();

  const [list, setList] = useState({ loading: true, error: null, items: [], pagination: null });
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const [modal, setModal] = useState({ open: false, editing: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, product: null, busy: false });

  // Debounced search box.
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
    if (status !== 'all') query.set('status', status);
    query.set('page', String(page));
    query.set('limit', '15');
    api
      .get(`/admin/products?${query.toString()}`)
      .then((data) =>
        setList({ loading: false, error: null, items: data.items, pagination: data.pagination })
      )
      .catch((err) => setList({ loading: false, error: err.message, items: [], pagination: null }));
  }, [search, status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .get('/admin/categories')
      .then((data) => setCategories(data.categories))
      .catch(() => setCategories([]));
  }, []);

  /* ------------------------------------------------------------ create/edit */

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, category_id: categories[0] ? String(categories[0].id) : '' });
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (product) => {
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: (product.price / 100).toFixed(2),
      category_id: String(product.category.id),
      image_path: product.image_path || '',
      is_active: Boolean(product.is_active),
      variants:
        product.variants.length > 0
          ? product.variants.map((v) => ({
              size: v.size,
              color: v.color,
              stock_quantity: v.stock_quantity,
            }))
          : [{ size: 'M', color: 'Black', stock_quantity: 0 }],
    });
    setErrors({});
    setModal({ open: true, editing: product });
  };

  const setField = (key) => (value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const setVariant = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, [key]: value } : v)),
    }));
  };

  const addVariant = () =>
    setForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { size: '', color: '', stock_quantity: 0 }],
    }));

  const removeVariant = (index) =>
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));

  const save = async (e) => {
    e.preventDefault();
    setErrors({});

    // Client-side pre-validation; the server validates again.
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    const price = Math.round(parseFloat(form.price) * 100);
    if (!Number.isFinite(price) || price <= 0) next.price = 'Enter a valid price.';
    if (!form.category_id) next.category_id = 'Pick a category.';
    if (form.variants.length === 0) next.variants = 'Add at least one variant.';
    if (form.variants.some((v) => !v.size.trim() || !v.color.trim()))
      next.variants = 'Every variant needs a size and a color.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description.trim(),
      price,
      category_id: Number(form.category_id),
      image_path: form.image_path.trim(),
      is_active: form.is_active,
      variants: form.variants.map((v) => ({
        size: v.size.trim(),
        color: v.color.trim(),
        stock_quantity: Math.max(0, parseInt(v.stock_quantity, 10) || 0),
      })),
    };

    setSaving(true);
    try {
      if (modal.editing) {
        await api.put(`/admin/products/${modal.editing.id}`, body);
        toast.success('Product updated');
      } else {
        await api.post('/admin/products', body);
        toast.success('Product created');
      }
      setModal({ open: false, editing: null });
      load();
    } catch (err) {
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      } else {
        setErrors({ name: err.message });
      }
      if (err.status === 409) toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  /* ------------------------------------------------------------- status/delete */

  const toggleStatus = async (product) => {
    try {
      await api.patch(`/admin/products/${product.id}/status`, {
        is_active: !product.is_active,
      });
      toast.success(`${product.name} is now ${product.is_active ? 'inactive' : 'active'}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setConfirm((prev) => ({ ...prev, busy: true }));
    try {
      await api.delete(`/admin/products/${confirm.product.id}`);
      toast.success('Product deleted');
      setConfirm({ open: false, product: null, busy: false });
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm({ open: false, product: null, busy: false });
    }
  };

  /* ------------------------------------------------------------------ render */

  const total = list.pagination ? list.pagination.total : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-sub">{total} product{total === 1 ? '' : 's'} in the catalog.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New product
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <input
            type="search"
            className="search-input"
            placeholder="Search products…"
            aria-label="Search products"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <select
            className="filter-select"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {list.loading && <Loader label="Loading products…" />}
        {!list.loading && list.error && <ErrorState error={list.error} onRetry={load} />}
        {!list.loading && !list.error && list.items.length === 0 && (
          <EmptyState
            title="No products found"
            message={search || status !== 'all' ? 'Try a different search or filter.' : 'Create your first product.'}
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                New product
              </button>
            }
          />
        )}

        {!list.loading && !list.error && list.items.length > 0 && (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th className="num">Price</th>
                    <th className="num">Stock</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="cell-product">
                          <ProductImage className="table-thumb" src={product.image_path} alt="" />
                          <div>
                            <div>{product.name}</div>
                            <div className="cell-sub">/{product.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td>{product.category ? product.category.name : '—'}</td>
                      <td className="num">{money(product.price)}</td>
                      <td className="num">
                        {product.total_stock === 0 ? (
                          <span className="badge badge-danger">Out</span>
                        ) : (
                          product.total_stock
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${product.is_active ? 'status-active' : 'status-inactive'}`}
                        >
                          {product.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn primary"
                            title="Edit product"
                            aria-label={`Edit ${product.name}`}
                            onClick={() => openEdit(product)}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={product.is_active ? 'Deactivate' : 'Activate'}
                            aria-label={`${product.is_active ? 'Deactivate' : 'Activate'} ${product.name}`}
                            onClick={() => toggleStatus(product)}
                          >
                            {product.is_active ? '⏻' : '✓'}
                          </button>
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Delete product"
                            aria-label={`Delete ${product.name}`}
                            onClick={() => setConfirm({ open: true, product, busy: false })}
                          >
                            ✕
                          </button>
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

      {/* ------------------------------------------------------------- modal */}
      <Modal
        open={modal.open}
        title={modal.editing ? `Edit — ${modal.editing.name}` : 'New product'}
        size="lg"
        onClose={saving ? undefined : () => setModal({ open: false, editing: null })}
        footer={
          <>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setModal({ open: false, editing: null })}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="submit" form="product-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.editing ? 'Save changes' : 'Create product'}
            </button>
          </>
        }
      >
        <form id="product-form" className="admin-form" onSubmit={save} noValidate>
          <div className="form-grid-2">
            <FormField
              label="Name"
              name="name"
              required
              value={form.name}
              onChange={setField('name')}
              error={errors.name}
            />
            <FormField
              label="Slug"
              name="slug"
              value={form.slug}
              onChange={setField('slug')}
              error={errors.slug}
              hint="Leave empty to generate from the name."
            />
            <FormField
              label="Category"
              name="category_id"
              as="select"
              required
              value={form.category_id}
              onChange={setField('category_id')}
              error={errors.category_id}
              options={categories.map((c) => ({ value: String(c.id), label: c.name }))}
            />
            <FormField
              label="Price (USD)"
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.price}
              onChange={setField('price')}
              error={errors.price}
            />
            <FormField
              label="Image path or URL"
              name="image_path"
              value={form.image_path}
              onChange={setField('image_path')}
              error={errors.image_path}
              hint="/images/products/item.svg or https://…"
            />
            <div className="field">
              <label htmlFor="f-active">Status</label>
              <label className="checkbox-row" htmlFor="f-active">
                <input
                  id="f-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setField('is_active')(e.target.checked)}
                />
                Active (visible in the store)
              </label>
            </div>
          </div>

          <FormField
            label="Description"
            name="description"
            as="textarea"
            value={form.description}
            onChange={setField('description')}
            error={errors.description}
          />

          <div className="variants-editor">
            <div className="variant-head">
              <span>Size</span>
              <span>Color</span>
              <span>Stock</span>
              <span aria-hidden="true" />
            </div>
            {form.variants.map((v, i) => (
              <div className="variant-row" key={`v-${i}`}>
                <input
                  type="text"
                  placeholder="M"
                  aria-label={`Variant ${i + 1} size`}
                  value={v.size}
                  onChange={(e) => setVariant(i, 'size', e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Black"
                  aria-label={`Variant ${i + 1} color`}
                  value={v.color}
                  onChange={(e) => setVariant(i, 'color', e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  aria-label={`Variant ${i + 1} stock`}
                  value={v.stock_quantity}
                  onChange={(e) => setVariant(i, 'stock_quantity', e.target.value)}
                />
                <button
                  type="button"
                  className="remove-variant"
                  onClick={() => removeVariant(i)}
                  aria-label={`Remove variant ${i + 1}`}
                  disabled={form.variants.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
            <div className="mt-2">
              <button type="button" className="btn btn-outline btn-sm" onClick={addVariant}>
                + Add size/color
              </button>
            </div>
            {errors.variants && <div className="field-error mt-2">{errors.variants}</div>}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        title="Delete product?"
        message={
          confirm.product
            ? `"${confirm.product.name}" will be removed from the catalog. Products that appear in order history cannot be deleted.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={confirm.busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm({ open: false, product: null, busy: false })}
      />
    </>
  );
}
