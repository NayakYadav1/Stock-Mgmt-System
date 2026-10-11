import { useEffect, useState, useCallback } from 'react';
import { Save } from 'lucide-react';
import { productsApi, purchasesApi } from '../services/api.js';
import { formatMoney, formatDate, todayISO } from '../utils.js';
import { Card, Field, PageLoader, Spinner, useToast, inputCls, btnPrimary } from '../components/ui.jsx';
import LineItems, { emptyRow } from '../components/LineItems.jsx';

const emptyHeader = () => ({
  supplier_name: '', bill_no: '', purchased_by: '', purchase_date: todayISO(), notes: '',
});

export default function Purchases() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState(emptyHeader());
  const [rows, setRows] = useState([emptyRow()]);

  const load = useCallback(async () => {
    try {
      const [prods, purchases] = await Promise.all([productsApi.getAll(), purchasesApi.getAll()]);
      setProducts(prods);
      setHistory(purchases);
    } catch (e) {
      toast('error', e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const billTotal = rows.reduce((sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0), 0);

  const submit = async () => {
    if (!header.supplier_name.trim()) return toast('error', 'Supplier name is required');
    if (!header.bill_no.trim()) return toast('error', 'Bill No is required');
    if (!header.purchased_by.trim()) return toast('error', 'Purchased By is required');
    if (!header.purchase_date) return toast('error', 'Purchase date is required');

    for (const r of rows) {
      if (!r.product_id) return toast('error', 'Select a product on every row');
      if (!(Number(r.quantity) > 0) || !Number.isInteger(Number(r.quantity)))
        return toast('error', 'Quantity must be a whole number greater than 0');
      if (r.price === '' || Number(r.price) < 0) return toast('error', 'Enter a valid unit cost on every row');
    }

    const body = {
      supplier_name: header.supplier_name.trim(),
      bill_no: header.bill_no.trim(),
      purchased_by: header.purchased_by.trim(),
      purchase_date: header.purchase_date,
      notes: header.notes.trim(),
      items: rows.map((r) => ({
        product_id: Number(r.product_id),
        quantity: Number(r.quantity),
        unit_cost: Number(r.price),
      })),
    };

    setBusy(true);
    try {
      const res = await purchasesApi.create(body);
      toast('success', res.message || 'Purchase saved');
      setHeader(emptyHeader());
      setRows([emptyRow()]);
      load();
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  if (loading) return <PageLoader />;

  const setField = (key) => (e) => setHeader({ ...header, [key]: e.target.value });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Stock IN - Purchase Bill</h1>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Supplier name *">
            <input className={inputCls} value={header.supplier_name} onChange={setField('supplier_name')} />
          </Field>
          <Field label="Bill No *">
            <input className={inputCls} value={header.bill_no} onChange={setField('bill_no')} />
          </Field>
          <Field label="Purchased By *">
            <input className={inputCls} value={header.purchased_by} onChange={setField('purchased_by')} />
          </Field>
          <Field label="Purchase date *">
            <input type="date" max={todayISO()} className={inputCls} value={header.purchase_date} onChange={setField('purchase_date')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <input className={inputCls} value={header.notes} onChange={setField('notes')} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Items</h2>
        <LineItems mode="purchase" products={products} rows={rows} setRows={setRows} />
      </Card>

      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase text-slate-500">Total Bill Amount</p>
          <p className="text-2xl font-bold">{formatMoney(billTotal)}</p>
        </div>
        <button className={`${btnPrimary} py-3`} disabled={busy} onClick={submit}>
          {busy ? <Spinner /> : <Save size={18} />} Save Purchase
        </button>
      </Card>

      {/* Recent purchases */}
      <Card>
        <h2 className="mb-3 font-semibold">Recent Purchases</h2>
        {history.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No purchases yet.</p>}
        <div className="space-y-3">
          {history.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.supplier_name}</p>
                  <p className="text-xs text-slate-500">
                    #{p.id} · {formatDate(p.purchase_date)}
                    {p.notes ? ` · ${p.notes}` : ''}
                  </p>
                </div>
                <p className="font-bold">{formatMoney(Number(p.total_amount))}</p>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {p.items.map((it) => (
                  <li key={it.id} className="flex justify-between gap-2">
                    <span>{it.product_name} x {it.quantity} @ {formatMoney(it.unit_cost)}</span>
                    <span>{formatMoney(it.line_total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}