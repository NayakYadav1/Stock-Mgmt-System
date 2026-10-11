import { useEffect, useState, useCallback, Fragment } from 'react';
import { HandCoins, ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { ledgerApi } from '../services/api.js';
import { formatMoney, formatDate, normalizeStatus } from '../utils.js';
import {
  Card, Modal, Field, StatusBadge, PageLoader, Spinner, useToast,
  inputCls, btnPrimary, btnGhost,
} from '../components/ui.jsx';

const METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'fonepay', label: 'Fonepay' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];
const methodLabel = (v) => METHODS.find((m) => m.value === v)?.label || v;

const emptyForm = { amount: '', payment_method: 'cash', reference_number: '', notes: '' };

// Payment history list for one sale
function PaymentHistory({ payments }) {
  if (!payments || payments.length === 0) {
    return <p className="text-sm text-slate-500">No payments received yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {payments.map((p) => (
        <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg bg-white p-2 text-sm shadow-sm">
          <div>
            <p className="font-medium">
              {formatDate(p.payment_date)} · {methodLabel(p.payment_method)}
            </p>
            {(p.reference_number || p.notes) && (
              <p className="text-xs text-slate-500">
                {p.reference_number ? `Ref: ${p.reference_number}` : ''}
                {p.reference_number && p.notes ? ' · ' : ''}
                {p.notes || ''}
              </p>
            )}
          </div>
          <p className="font-semibold text-green-700">{formatMoney(p.amount)}</p>
        </li>
      ))}
    </ul>
  );
}

export default function Ledger() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [paying, setPaying] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Search / filter / view
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | DUE | PARTIAL
  const [view, setView] = useState('sales'); // sales | customers

  const load = useCallback(async () => {
    try {
      const data = await ledgerApi.getDue();
      setRows(data.filter((r) => r.due_amount > 0));
    } catch (e) {
      toast('error', e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  /* ---------- Filtering ---------- */
  const term = search.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    const matchText =
      !term ||
      r.customer_name.toLowerCase().includes(term) ||
      String(r.sale_id) === term.replace('#', '');
    const matchStatus = statusFilter === 'ALL' || normalizeStatus(r.payment_status) === statusFilter;
    return matchText && matchStatus;
  });

  const totalOutstanding = rows.reduce((sum, r) => sum + r.due_amount, 0);
  const filteredOutstanding = filtered.reduce((sum, r) => sum + r.due_amount, 0);
  const isFiltering = term !== '' || statusFilter !== 'ALL';

  /* ---------- Group the filtered sales by customer ---------- */
  const customers = Object.values(
    filtered.reduce((acc, r) => {
      const key = r.customer_name.trim().toLowerCase();
      if (!acc[key]) acc[key] = { name: r.customer_name.trim(), count: 0, total: 0, paid: 0, due: 0 };
      acc[key].count += 1;
      acc[key].total += r.total_amount;
      acc[key].paid += r.amount_paid;
      acc[key].due += r.due_amount;
      return acc;
    }, {})
  ).sort((a, b) => b.due - a.due); // biggest debt first

  const clearFilters = () => { setSearch(''); setStatusFilter('ALL'); };
  const viewCustomerSales = (name) => { setSearch(name); setStatusFilter('ALL'); setView('sales'); };
  const toggleOpen = (id) => setOpenId(openId === id ? null : id);

  const openPay = (row) => { setPaying(row); setForm(emptyForm); };

  const submitPayment = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast('error', 'Enter an amount greater than 0');
    if (amount > paying.due_amount + 0.001)
      return toast('error', `Amount cannot be more than the due balance (${formatMoney(paying.due_amount)})`);

    const body = {
      sale_id: Number(paying.sale_id),
      amount_received: amount,
      payment_method: form.payment_method,
    };
    if (form.reference_number.trim()) body.reference_number = form.reference_number.trim();
    if (form.notes.trim()) body.notes = form.notes.trim();

    setBusy(true);
    try {
      const res = await ledgerApi.pay(body);
      toast('success', res.message || 'Payment recorded successfully');
      setPaying(null);
      load();
    } catch (err) {
      toast('error', err.message);
    }
    setBusy(false);
  };

  if (loading) return <PageLoader />;

  const tabCls = (active) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-xl font-bold">Credit Ledger and Collections</h1>
        <p className="text-sm text-slate-600">
          Total outstanding: <b className="text-red-600">{formatMoney(totalOutstanding)}</b>
        </p>
      </div>

      {/* Search, filter and view toggle */}
      <Card className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className={`${inputCls} pl-9`}
              placeholder="Search customer name or sale #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={`${inputCls} sm:w-44`}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All status</option>
            <option value="DUE">DUE only</option>
            <option value="PARTIAL">PARTIAL only</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button className={tabCls(view === 'sales')} onClick={() => setView('sales')}>By Sale</button>
            <button className={tabCls(view === 'customers')} onClick={() => setView('customers')}>By Customer</button>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Showing {filtered.length} of {rows.length} sales
              {isFiltering && <> · Due (shown): <b className="text-red-600">{formatMoney(filteredOutstanding)}</b></>}
            </span>
            {isFiltering && (
              <button className="flex items-center gap-1 font-medium text-indigo-600 hover:underline" onClick={clearFilters}>
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {/* ================= BY SALE VIEW ================= */}
        {view === 'sales' && (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Sale #</th>
                    <th>Customer</th>
                    <th>Sale Date</th>
                    <th className="text-right">Total Bill</th>
                    <th className="text-right">Total Paid</th>
                    <th className="text-right">Remaining Due</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <Fragment key={r.sale_id}>
                      <tr className="hover:bg-slate-50">
                        <td className="py-3 text-slate-500">#{r.sale_id}</td>
                        <td>
                          <p className="font-medium">{r.customer_name}</p>
                          {r.notes && <p className="max-w-xs truncate text-xs text-slate-500">{r.notes}</p>}
                        </td>
                        <td>{formatDate(r.sale_date)}</td>
                        <td className="text-right">{formatMoney(r.total_amount)}</td>
                        <td className="text-right">{formatMoney(r.amount_paid)}</td>
                        <td className="text-right font-semibold text-red-600">{formatMoney(r.due_amount)}</td>
                        <td><StatusBadge status={r.payment_status} /></td>
                        <td className="text-right">
                          <div className="flex justify-end gap-2">
                            <button className={btnGhost} onClick={() => toggleOpen(r.sale_id)}>
                              {openId === r.sale_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />} History
                            </button>
                            <button className={btnPrimary} onClick={() => openPay(r)}>
                              <HandCoins size={16} /> Collect Payment
                            </button>
                          </div>
                        </td>
                      </tr>
                      {openId === r.sale_id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-50 p-3">
                            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Payment history</p>
                            <PaymentHistory payments={r.payment_history} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {filtered.map((r) => (
                <div key={r.sale_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.customer_name}</p>
                      <p className="text-xs text-slate-500">#{r.sale_id} · {formatDate(r.sale_date)}</p>
                    </div>
                    <StatusBadge status={r.payment_status} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-500">
                    <div>Total<p className="text-sm font-medium text-slate-800">{formatMoney(r.total_amount)}</p></div>
                    <div>Paid<p className="text-sm font-medium text-slate-800">{formatMoney(r.amount_paid)}</p></div>
                    <div>Due<p className="text-sm font-bold text-red-600">{formatMoney(r.due_amount)}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className={`${btnGhost} flex-1`} onClick={() => toggleOpen(r.sale_id)}>
                      {openId === r.sale_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />} History
                    </button>
                    <button className={`${btnPrimary} flex-1`} onClick={() => openPay(r)}>
                      <HandCoins size={16} /> Collect
                    </button>
                  </div>
                  {openId === r.sale_id && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-2">
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Payment history</p>
                      <PaymentHistory payments={r.payment_history} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ================= BY CUSTOMER VIEW ================= */}
        {view === 'customers' && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-2">Customer</th>
                    <th className="text-right">Unpaid Sales</th>
                    <th className="text-right">Total Bill</th>
                    <th className="text-right">Total Paid</th>
                    <th className="text-right">Total Due</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.name.toLowerCase()} className="hover:bg-slate-50">
                      <td className="py-3 font-medium">{c.name}</td>
                      <td className="text-right">{c.count}</td>
                      <td className="text-right">{formatMoney(c.total)}</td>
                      <td className="text-right">{formatMoney(c.paid)}</td>
                      <td className="text-right font-semibold text-red-600">{formatMoney(c.due)}</td>
                      <td className="text-right">
                        <button className={btnGhost} onClick={() => viewCustomerSales(c.name)}>View sales</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {customers.map((c) => (
                <div key={c.name.toLowerCase()} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.count} unpaid sale{c.count > 1 ? 's' : ''}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-3 text-center text-xs text-slate-500">
                    <div>Total<p className="text-sm font-medium text-slate-800">{formatMoney(c.total)}</p></div>
                    <div>Paid<p className="text-sm font-medium text-slate-800">{formatMoney(c.paid)}</p></div>
                    <div>Due<p className="text-sm font-bold text-red-600">{formatMoney(c.due)}</p></div>
                  </div>
                  <button className={`${btnGhost} mt-3 w-full`} onClick={() => viewCustomerSales(c.name)}>
                    View sales
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty states */}
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No outstanding balances. All sales are fully paid.</p>
        )}
        {rows.length > 0 && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-500">No sales match your search or filter.</p>
        )}
      </Card>

      {/* Collect Payment modal */}
      {paying && (
        <Modal title="Collect Payment" onClose={() => setPaying(null)}>
          <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
            <p className="font-semibold">{paying.customer_name} · Sale #{paying.sale_id}</p>
            <div className="mt-1 flex justify-between text-slate-600">
              <span>Total {formatMoney(paying.total_amount)}</span>
              <span>Paid {formatMoney(paying.amount_paid)}</span>
            </div>
            <p className="mt-1 text-red-600">
              Remaining due: <b>{formatMoney(paying.due_amount)}</b>
            </p>
          </div>

          <form onSubmit={submitPayment} className="space-y-3">
            <Field label="Amount received *">
              <div className="flex gap-2">
                <input
                  type="number" min="0" step="0.01" autoFocus
                  className={inputCls}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
                <button
                  type="button"
                  className={btnGhost}
                  onClick={() => setForm({ ...form, amount: String(paying.due_amount) })}
                >
                  Full
                </button>
              </div>
            </Field>
            <Field label="Payment method *">
              <select
                className={inputCls}
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Reference number (optional)">
              <input
                className={inputCls}
                value={form.reference_number}
                onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
              />
            </Field>
            <Field label="Notes (optional)">
              <input
                className={inputCls}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={btnGhost} onClick={() => setPaying(null)}>Cancel</button>
              <button className={btnPrimary} disabled={busy}>
                {busy && <Spinner />} Record Payment
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}