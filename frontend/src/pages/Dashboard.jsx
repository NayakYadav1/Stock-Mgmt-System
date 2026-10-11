import { useEffect, useState, useCallback } from 'react';
import { Package, AlertTriangle, Banknote, Plus, Pencil, Trash2 } from 'lucide-react';
import { productsApi, ledgerApi } from '../services/api.js';
import { LOW_STOCK_LIMIT, formatMoney } from '../utils.js';
import {
  Card, StatCard, Modal, Field, PageLoader, Spinner, useToast,
  inputCls, btnPrimary, btnGhost, btnDanger,
} from '../components/ui.jsx';

const emptyAdd = {
  sku: '', name: '', description: '', cost_price: '', selling_price: '', stock_quantity: '',
};

export default function Dashboard() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [totalDue, setTotalDue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [addForm, setAddForm] = useState(null);   // null = closed
  const [editForm, setEditForm] = useState(null); // null = closed
  const [deleting, setDeleting] = useState(null); // product to delete, or null

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

  /* ---------- Add ---------- */
  const submitAdd = async (e) => {
    e.preventDefault();
    const f = addForm;
    if (!f.sku.trim()) return toast('error', 'SKU is required');
    if (!f.name.trim()) return toast('error', 'Product name is required');
    if (f.cost_price === '' || Number(f.cost_price) < 0) return toast('error', 'Enter a valid cost price');
    if (f.selling_price === '' || Number(f.selling_price) < 0) return toast('error', 'Enter a valid selling price');
    if (f.stock_quantity === '' || Number(f.stock_quantity) < 0) return toast('error', 'Enter the opening stock (0 or more)');

    setBusy(true);
    try {
      const res = await productsApi.create({
        sku: f.sku.trim(),
        name: f.name.trim(),
        description: f.description.trim(),
        cost_price: Number(f.cost_price),
        selling_price: Number(f.selling_price),
        stock_quantity: Number(f.stock_quantity),
      });
      toast('success', res.message || 'Product created successfully');
      setAddForm(null);
      load();
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  /* ---------- Edit (only name + selling_price) ---------- */
  const submitEdit = async (e) => {
    e.preventDefault();
    const f = editForm;
    if (!f.name.trim()) return toast('error', 'Product name is required');
    if (f.selling_price === '' || Number(f.selling_price) < 0) return toast('error', 'Enter a valid selling price');

    setBusy(true);
    try {
      const res = await productsApi.update(f.id, {
        name: f.name.trim(),
        selling_price: Number(f.selling_price),
      });
      toast('success', res.message || 'Product updated successfully');
      setEditForm(null);
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

  const setAdd = (key) => (e) => setAddForm({ ...addForm, [key]: e.target.value });
  const setEdit = (key) => (e) => setEditForm({ ...editForm, [key]: e.target.value });

  const stockClass = (p) =>
    p.stock_quantity <= LOW_STOCK_LIMIT ? 'font-semibold text-red-600' : 'text-slate-800';

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
          <button className={btnPrimary} onClick={() => setAddForm(emptyAdd)}>
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
                  <td className="text-right">{formatMoney(p.selling_price)}</td>
                  <td className="text-right">
                    <button
                      className="p-2 text-slate-500 hover:text-indigo-600"
                      title="Edit"
                      onClick={() => setEditForm({ id: p.id, name: p.name, selling_price: p.selling_price })}
                    >
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
              <div className="mt-2 flex justify-between text-sm text-slate-600">
                <span>Cost {formatMoney(p.cost_price)}</span>
                <span>Sell {formatMoney(p.selling_price)}</span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  className={btnGhost}
                  onClick={() => setEditForm({ id: p.id, name: p.name, selling_price: p.selling_price })}
                >
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

      {/* Add modal */}
      {addForm && (
        <Modal title="Add Product" onClose={() => setAddForm(null)}>
          <form onSubmit={submitAdd} className="space-y-3">
            <Field label="SKU *"><input className={inputCls} value={addForm.sku} onChange={setAdd('sku')} /></Field>
            <Field label="Product name *"><input className={inputCls} value={addForm.name} onChange={setAdd('name')} /></Field>
            <Field label="Description">
              <textarea rows="2" className={inputCls} value={addForm.description} onChange={setAdd('description')} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cost price *">
                <input type="number" min="0" step="0.01" className={inputCls} value={addForm.cost_price} onChange={setAdd('cost_price')} />
              </Field>
              <Field label="Selling price *">
                <input type="number" min="0" step="0.01" className={inputCls} value={addForm.selling_price} onChange={setAdd('selling_price')} />
              </Field>
            </div>
            <Field label="Opening stock quantity *">
              <input type="number" min="0" step="1" className={inputCls} value={addForm.stock_quantity} onChange={setAdd('stock_quantity')} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setAddForm(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy}>{busy && <Spinner />} Save Product</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit modal */}
      {editForm && (
        <Modal title="Edit Product" onClose={() => setEditForm(null)}>
          <form onSubmit={submitEdit} className="space-y-3">
            <Field label="Product name *"><input className={inputCls} value={editForm.name} onChange={setEdit('name')} /></Field>
            <Field label="Selling price *">
              <input type="number" min="0" step="0.01" className={inputCls} value={editForm.selling_price} onChange={setEdit('selling_price')} />
            </Field>
            <p className="text-xs text-slate-500">Stock changes only through Stock IN and Stock OUT.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setEditForm(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy}>{busy && <Spinner />} Update</button>
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