import { useState } from 'react';
import { productsApi } from '../services/api.js';
import { Modal, Field, Spinner, useToast, inputCls, btnPrimary, btnGhost } from './ui.jsx';

const empty = { sku: '', name: '', description: '', cost_price: '', selling_price: '' };

export default function NewProductModal({ onClose, onCreated }) {
  const toast = useToast();
  const [v, setV] = useState(empty);
  const [busy, setBusy] = useState(false);
  const set = (key) => (e) => setV({ ...v, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!v.sku.trim()) return toast('error', 'SKU is required');
    if (!v.name.trim()) return toast('error', 'Product name is required');
    if (v.cost_price === '' || Number(v.cost_price) < 0) return toast('error', 'Enter a valid cost price');
    if (v.selling_price === '' || Number(v.selling_price) < 0) return toast('error', 'Enter a valid selling price');

    setBusy(true);
    try {
      const res = await productsApi.create({
        sku: v.sku.trim(),
        name: v.name.trim(),
        description: v.description.trim(),
        cost_price: Number(v.cost_price),
        selling_price: Number(v.selling_price),
        stock_quantity: 0, // stock comes from the purchase you are entering
      });
      toast('success', res.message || 'Product created successfully');
      await onCreated(res.data.id);
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  return (
    <Modal title="Create New Product" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="SKU *"><input className={inputCls} value={v.sku} onChange={set('sku')} /></Field>
        <Field label="Product name *"><input className={inputCls} value={v.name} onChange={set('name')} /></Field>
        <Field label="Description">
          <textarea rows="2" className={inputCls} value={v.description} onChange={set('description')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost price *">
            <input type="number" min="0" step="0.01" className={inputCls} value={v.cost_price} onChange={set('cost_price')} />
          </Field>
          <Field label="Selling price *">
            <input type="number" min="0" step="0.01" className={inputCls} value={v.selling_price} onChange={set('selling_price')} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          The product starts with 0 stock. Enter the quantity in the purchase and save it to add stock.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} disabled={busy}>{busy && <Spinner />} Create Product</button>
        </div>
      </form>
    </Modal>
  );
}