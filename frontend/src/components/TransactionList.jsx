import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from 'lucide-react';
import { StatusBadge } from './ui.jsx';
import { formatMoney, formatDate, formatRef, dayKey, dayLabel } from '../utils.js';

// type = 'purchase' (Stock IN) or 'sale' (Stock OUT)
export default function TransactionList({ type, items, emptyText }) {
  const isSale = type === 'sale';
  const [openId, setOpenId] = useState(null);
  const dateOf = (t) => (isSale ? t.sale_date : t.purchase_date);

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">{emptyText}</p>;
  }

  // Newest first, then group by day
  const sorted = [...items].sort(
    (a, b) => new Date(dateOf(b)) - new Date(dateOf(a)) || Number(b.id) - Number(a.id)
  );
  const groups = [];
  sorted.forEach((t) => {
    const key = dayKey(dateOf(t));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(t);
    else groups.push({ key, label: dayLabel(dateOf(t)), rows: [t] });
  });

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {group.rows.map((t) => {
              const open = openId === t.id;
              const rowItems = t.items || [];
              const units = rowItems.reduce((sum, it) => sum + Number(it.quantity), 0);
              const unitPrice = (it) => (isSale ? it.selling_price : it.unit_cost);
              const total = Number(t.total_amount);
              const details = [
                ['Date', formatDate(dateOf(t))],
                isSale ? ['Phone', t.customer_phone] : ['Bill No', t.bill_no],
                isSale ? ['Sold by', t.sold_by] : ['Purchased by', t.purchased_by],
                ['Notes', t.notes],
              ].filter(([, value]) => value);

              return (
                <div key={t.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : t.id)}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50 sm:p-4"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        isSale ? 'bg-indigo-50 text-indigo-600' : 'bg-green-50 text-green-600'
                      }`}
                    >
                      {isSale ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900">
                        {isSale ? t.customer_name : t.supplier_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600">
                          {formatRef(isSale ? 'INV' : 'PUR', t.id)}
                        </span>{' '}
                        · {rowItems.length} item{rowItems.length === 1 ? '' : 's'} · {units} unit{units === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <p className="font-bold text-slate-900">{formatMoney(total)}</p>
                      {isSale && t.payment_status && <StatusBadge status={t.payment_status} />}
                    </div>

                    <ChevronDown
                      size={18}
                      className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {open && (
                    <div className="bg-slate-50 px-3 pb-4 pt-3 sm:px-4">
                      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                        {details.map(([label, value]) => (
                          <div key={label} className="flex gap-2">
                            <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
                            <dd className="font-medium text-slate-800">{value}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
                        <div className="hidden grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase text-slate-500 sm:grid">
                          <span className="col-span-6">Item</span>
                          <span className="col-span-2 text-right">Qty</span>
                          <span className="col-span-2 text-right">{isSale ? 'Price' : 'Unit cost'}</span>
                          <span className="col-span-2 text-right">Total</span>
                        </div>
                        {rowItems.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2 last:border-0 sm:grid sm:grid-cols-12"
                          >
                            <div className="sm:col-span-6">
                              <p className="font-medium text-slate-900">{it.product_name}</p>
                              <p className="text-xs text-slate-500">
                                {it.sku}
                                <span className="sm:hidden"> · {it.quantity} × {formatMoney(unitPrice(it))}</span>
                              </p>
                            </div>
                            <span className="hidden text-right sm:col-span-2 sm:block">{it.quantity}</span>
                            <span className="hidden text-right sm:col-span-2 sm:block">{formatMoney(unitPrice(it))}</span>
                            <span className="text-right font-semibold sm:col-span-2">{formatMoney(it.line_total)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 space-y-1 text-right text-sm">
                        <p className="text-slate-500">
                          Total <b className="ml-2 text-base text-slate-900">{formatMoney(total)}</b>
                        </p>
                        {isSale && t.amount_paid != null && (
                          <>
                            <p className="text-slate-500">
                              Paid <b className="ml-2 text-green-700">{formatMoney(Number(t.amount_paid))}</b>
                            </p>
                            <p className="text-slate-500">
                              Due{' '}
                              <b className="ml-2 text-red-600">
                                {formatMoney(t.due_amount != null ? Number(t.due_amount) : total - Number(t.amount_paid))}
                              </b>
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}