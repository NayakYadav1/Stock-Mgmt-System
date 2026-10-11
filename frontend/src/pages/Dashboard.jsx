import { useEffect, useState, useCallback } from 'react';
import { Package, AlertTriangle, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';
import { productsApi, ledgerApi } from '../services/api.js';
import { LOW_STOCK_LIMIT, formatMoney } from '../utils.js';
import {
  Card, StatCard, Modal, Field, PageLoader, Spinner, useToast,
  inputCls, btnPrimary, btnGhost, btnDanger,
} from '../components/ui.jsx';

const emptyValues = {
  sku: '', name: '', description: '', cost_price: '', selling_price: '', stock_quantity: '',
};

// Fill the form with the product's current values
const toFormValues = (p) => ({
  sku: p.sku,
  name: p.name,
  description: p.description || '',
  cost_price: p.cost_price,
  selling_price: p.selling_price,
  stock_quantity: p.stock_quantity,
});

export default function Dashboard() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // null = closed, otherwise { mode: 'add' | 'edit', id, values }
  const [formModal, setFormModal] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    try {
      const [prods, due] = await Promise.all([productsApi.getAll(), ledgerApi.getDue()]);
      setProducts(prods);
      setTotalDue(due.reduce((sum, d) => sum + d.due_amount, 0));
    } catch (e) {
      toast('error', e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const lowStockCount = products.filter((p) => p.stock_quantity <= LOW_STOCK_LIMIT).length;
  const isEdit = formModal?.mode === 'edit';

  const setValue = (key) => (e) =>
    setFormModal({ ...formModal, values: { ...formModal.values, [key]: e.target.value } });

  /* ---------- Add / Edit (same form) ---------- */
  const submitForm = async (e) => {
    e.preventDefault();
    const v = formModal.values;
    if (!String(v.sku).trim()) return toast('error', 'SKU is required');
    if (!String(v.name).trim()) return toast('error', 'Product name is required');
    if (v.cost_price === '' || Number(v.cost_price) < 0) return toast('error', 'Enter a valid cost price');
    if (v.selling_price === '' || Number(v.selling_price) < 0) return toast('error', 'Enter a valid selling price');
    if (v.stock_quantity === '' || Number(v.stock_quantity) < 0 || !Number.isInteger(Number(v.stock_quantity)))
      return toast('error', 'Stock must be a whole number (0 or more)');

    const body = {
      sku: String(v.sku).trim(),
      name: String(v.name).trim(),
      description: String(v.description).trim(),
      cost_price: Number(v.cost_price),
      selling_price: Number(v.selling_price),
      stock_quantity: Number(v.stock_quantity),
    };

    setBusy(true);
    try {
      const res = isEdit
        ? await productsApi.update(formModal.id, body)
        : await productsApi.create(body);
      toast('success', res.message || (isEdit ? 'Product updated successfully' : 'Product created successfully'));
      setFormModal(null);
      load();
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  /* ---------- Delete ---------- */
  const confirmDelete = async () => {
    setBusy(true);
    try {
      const res = await productsApi.remove(deleting.id);
      toast('success', res.message || 'Product deleted successfully');
      setDeleting(null);
      load();
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  if (loading) return <PageLoader />;

  const openEdit = (p) => setFormModal({ mode: 'edit', id: p.id, values: toFormValues(p) });
  const stockClass = (p) =>
    p.stock_quantity <= LOW_STOCK_LIMIT ? 'font-semibold text-red-600' : 'text-slate-800';
  const latestCost = (p) => (p.latest_unit_cost == null ? '—' : formatMoney(p.latest_unit_cost));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Package} label="Total Products" value={products.length} />
        <StatCard icon={AlertTriangle} tone="amber" label="Low Stock Items" value={lowStockCount} />
        <StatCard icon={Banknote} tone="red" label="Uncollected Credit" value={formatMoney(totalDue)} />
      </div>

      {/* Products */}
      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Products</h2>
          <button className={btnPrimary} onClick={() => setFormModal({ mode: 'add', values: emptyValues })}>
            <Plus size={16} /> Add Product
          </button>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2">Product</th>
                <th>SKU</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Cost Price</th>
                <th className="text-right">Latest Purchase Cost</th>
                <th className="text-right">Selling Price</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3">
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="max-w-xs truncate text-xs text-slate-500">{p.description}</p>}
                  </td>
                  <td className="text-slate-500">{p.sku}</td>
                  <td className="text-right">
                    <span className={stockClass(p)}>{p.stock_quantity}</span>
                    {p.stock_quantity <= LOW_STOCK_LIMIT && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Low</span>
                    )}
                  </td>
                  <td className="text-right">{formatMoney(p.cost_price)}</td>
                  <td className="text-right">{latestCost(p)}</td>
                  <td className="text-right">{formatMoney(p.selling_price)}</td>
                  <td className="text-right">
                    <button className="p-2 text-slate-500 hover:text-indigo-600" title="Edit" onClick={() => openEdit(p)}>
                      <Pencil size={16} />
                    </button>
                    <button className="p-2 text-slate-500 hover:text-red-600" title="Delete" onClick={() => setDeleting(p)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="space-y-3 md:hidden">
          {products.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.sku}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    p.stock_quantity <= LOW_STOCK_LIMIT ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Stock {p.stock_quantity}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-500">
                <div>Cost<p className="text-sm text-slate-800">{formatMoney(p.cost_price)}</p></div>
                <div>Latest cost<p className="text-sm text-slate-800">{latestCost(p)}</p></div>
                <div>Selling<p className="text-sm text-slate-800">{formatMoney(p.selling_price)}</p></div>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button className={btnGhost} onClick={() => openEdit(p)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className={btnGhost} onClick={() => setDeleting(p)}>
                  <Trash2 size={14} className="text-red-600" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {products.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No products yet. Click "Add Product" to create one.</p>
        )}
      </Card>

      {/* Add / Edit modal */}
      {formModal && (
        <Modal title={isEdit ? 'Edit Product' : 'Add Product'} onClose={() => setFormModal(null)}>
          <form onSubmit={submitForm} className="space-y-3">
            <Field label="SKU *"><input className={inputCls} value={formModal.values.sku} onChange={setValue('sku')} /></Field>
            <Field label="Product name *"><input className={inputCls} value={formModal.values.name} onChange={setValue('name')} /></Field>
            <Field label="Description">
              <textarea rows="2" className={inputCls} value={formModal.values.description} onChange={setValue('description')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost price *">
                <input type="number" min="0" step="0.01" className={inputCls} value={formModal.values.cost_price} onChange={setValue('cost_price')} />
              </Field>
              <Field label="Selling price *">
                <input type="number" min="0" step="0.01" className={inputCls} value={formModal.values.selling_price} onChange={setValue('selling_price')} />
              </Field>
            </div>
            <Field label={isEdit ? 'Stock quantity *' : 'Opening stock quantity *'}>
              <input type="number" min="0" step="1" className={inputCls} value={formModal.values.stock_quantity} onChange={setValue('stock_quantity')} />
            </Field>
            {isEdit && (
              <p className="rounded bg-amber-50 p-2 text-xs text-amber-700">
                Changing stock here does not create a purchase or sale record. For normal stock changes use Stock IN or Stock OUT.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setFormModal(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy}>
                {busy && <Spinner />} {isEdit ? 'Save Changes' : 'Save Product'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleting && (
        <Modal title="Delete product?" onClose={() => setDeleting(null)}>
          <div className="flex gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle size={20} className="shrink-0" />
            <p>
              You are about to permanently delete <b>{deleting.name}</b> ({deleting.sku}). This cannot be undone.
              If this product has sales or purchase history, the server may refuse to delete it.
            </p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setDeleting(null)}>Cancel</button>
            <button className={btnDanger} disabled={busy} onClick={confirmDelete}>
              {busy && <Spinner />} Yes, Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}