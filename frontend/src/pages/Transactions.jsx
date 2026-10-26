import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, RefreshCw } from "lucide-react";
import { transactionsApi } from "../services/api.js";
import { formatDate, formatMoney } from "../utils.js";
import { useToast } from "../components/ui.jsx";
import StockInForm from "../components/StockInForm.jsx";
import StockOutForm from "../components/StockOutForm.jsx";

export default function Transactions() {
  const toast = useToast();
  const [transactions, setTransactions] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setTransactions(await transactionsApi.getAll());
    } catch (err) {
      setError(err.message || "Could not load transactions");
      toast("error", err.message || "Could not load transactions");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleTransactions = transactions.filter(
    (transaction) =>
      filter === "all" || transaction.transaction_type === filter,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review stock purchases and sales.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <StockInForm onSaved={load} />
        <StockOutForm onSaved={load} />
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All"],
          ["purchase", "Stock IN"],
          ["sale", "Stock OUT"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              filter === value
                ? "bg-indigo-600 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="py-10 text-center text-sm text-slate-500">
          Loading transactions...
        </p>
      )}

      {!loading && error && (
        <section className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-rose-700">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </section>
      )}

      {!loading && !error && visibleTransactions.length === 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-800">No transactions found</p>
          <p className="mt-1 text-sm text-slate-500">
            Choose another filter or record a transaction.
          </p>
        </section>
      )}

      {!loading && !error && visibleTransactions.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTransactions.map((transaction) => {
                  const isPurchase =
                    transaction.transaction_type === "purchase";

                  return (
                    <tr key={transaction.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isPurchase
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {isPurchase ? (
                            <ArrowDownLeft size={14} />
                          ) : (
                            <ArrowUpRight size={14} />
                          )}
                          {isPurchase ? "IN" : "OUT"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {transaction.party_name}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(transaction.transaction_date)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {(transaction.items || []).reduce(
                          (total, item) => total + item.quantity,
                          0,
                        )}{" "}
                        units · {(transaction.items || []).length} products
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900">
                        {formatMoney(transaction.total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
