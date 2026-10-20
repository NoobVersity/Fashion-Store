import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import Loader from '../../components/Loader.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Modal from '../../components/Modal.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import FormField from '../../components/FormField.jsx';

const EMPTY_FORM = { name: '', description: '', is_active: true };

/** Category CRUD. Deletion is refused (409) while products reference it. */
export default function Categories() {
  const { toast } = useToast();
  const [state, setState] = useState({ loading: true, error: null, items: [] });
  const [modal, setModal] = useState({ open: false, editing: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, category: null, busy: false });

  const load = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    api
      .get('/admin/categories')
      .then((data) => setState({ loading: false, error: null, items: data.categories }))
      .catch((err) => setState({ loading: false, error: err.message, items: [] }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setModal({ open: true, editing: null });
  };

  const openEdit = (category) => {
    setForm({
      name: category.name,
      description: category.description || '',
      is_active: Boolean(category.is_active),
    });
    setErrors({});
    setModal({ open: true, editing: category });
  };

  const save = async (e) => {
    e.preventDefault();
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      is_active: form.is_active,
    };

    setSaving(true);
    try {
      if (modal.editing) {
        await api.put(`/admin/categories/${modal.editing.id}`, body);
        toast.success('Category updated');
      } else {
        await api.post('/admin/categories', body);
        toast.success('Category created');
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

  const toggleStatus = async (category) => {
    try {
      await api.patch(`/admin/categories/${category.id}/status`, {
        is_active: !category.is_active,
      });
      toast.success(`${category.name} is now ${category.is_active ? 'inactive' : 'active'}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doDelete = async () => {
    setConfirm((prev) => ({ ...prev, busy: true }));
    try {
      await api.delete(`/admin/categories/${confirm.category.id}`);
      toast.success('Category deleted');
      setConfirm({ open: false, category: null, busy: false });
      load();
    } catch (err) {
      toast.error(err.message);
      setConfirm({ open: false, category: null, busy: false });
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Categories</h1>
          <p className="page-sub">{state.items.length} categor{state.items.length === 1 ? 'y' : 'ies'}.</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            New category
          </button>
        </div>
      </div>

      <div className="panel">
        {state.loading && <Loader label="Loading categories…" />}
        {!state.loading && state.error && <ErrorState error={state.error} onRetry={load} />}
        {!state.loading && !state.error && state.items.length === 0 && (
          <EmptyState
            title="No categories yet"
            message="Categories group products in the storefront filters."
            action={
              <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
                New category
              </button>
            }
          />
        )}

        {!state.loading && !state.error && state.items.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th className="num">Products</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {state.items.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div>{category.name}</div>
                      <div className="cell-sub">/{category.slug}</div>
                    </td>
                    <td className="muted">{category.description || '—'}</td>
                    <td className="num">{category.product_count}</td>
                    <td>
                      <span
                        className={`status-pill ${category.is_active ? 'status-active' : 'status-inactive'}`}
                      >
                        {category.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="icon-btn primary"
                          title="Edit category"
                          aria-label={`Edit ${category.name}`}
                          onClick={() => openEdit(category)}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          title={category.is_active ? 'Deactivate' : 'Activate'}
                          aria-label={`${category.is_active ? 'Deactivate' : 'Activate'} ${category.name}`}
                          onClick={() => toggleStatus(category)}
                        >
                          {category.is_active ? '⏻' : '✓'}
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete category"
                          aria-label={`Delete ${category.name}`}
                          onClick={() => setConfirm({ open: true, category, busy: false })}
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
        )}
      </div>

      <Modal
        open={modal.open}
        title={modal.editing ? `Edit — ${modal.editing.name}` : 'New category'}
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
            <button type="submit" form="category-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.editing ? 'Save changes' : 'Create category'}
            </button>
          </>
        }
      >
        <form id="category-form" className="admin-form" onSubmit={save} noValidate>
          <FormField
            label="Name"
            name="name"
            required
            value={form.name}
            onChange={(v) => {
              setForm((prev) => ({ ...prev, name: v }));
              setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />
          <FormField
            label="Description"
            name="description"
            as="textarea"
            value={form.description}
            onChange={(v) => setForm((prev) => ({ ...prev, description: v }))}
            error={errors.description}
          />
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
            Active (visible in the store)
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm.open}
        title="Delete category?"
        message={
          confirm.category
            ? `"${confirm.category.name}" will be deleted. Categories that still contain products cannot be removed.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={confirm.busy}
        onConfirm={doDelete}
        onCancel={() => setConfirm({ open: false, category: null, busy: false })}
      />
    </>
  );
}
