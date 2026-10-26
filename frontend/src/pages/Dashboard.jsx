import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Package,
  RefreshCw,
} from "lucide-react";
import { dashboardApi } from "../services/api.js";
import { formatMoney } from "../utils.js";
import { useToast } from "../components/ui.jsx";

function StatCard({ icon: Icon, label, value, tone }) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
  };

  return (
    <section className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`rounded-lg p-3 ${colors[tone]}`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
      </div>
    </section>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await dashboardApi.getSummary();
      setSummary(data);
    } catch (err) {
      setError(err.message || "Could not load dashboard data");
      toast("error", err.message || "Could not load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !summary) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">
        Loading dashboard...
      </div>
    );
  }

  if (error && !summary) {
    return (
      <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
        <h1 className="font-semibold text-slate-900">Dashboard unavailable</h1>
        <p className="mt-2 text-sm text-rose-700">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <RefreshCw size={16} />
          Retry
        </button>
      </section>
    );
  }

  const lowStockProducts = summary?.low_stock_products ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of your stock and party balances.
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

      {error && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          Refresh failed: {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Package}
          label="Total Items"
          value={summary.total_products}
          tone="indigo"
        />
        <StatCard
          icon={Banknote}
          label="Inventory Value"
          value={formatMoney(summary.inventory_value)}
          tone="indigo"
        />
        <StatCard
          icon={ArrowDownLeft}
          label="Total Receivables"
          value={formatMoney(summary.receivables)}
          tone="green"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Total Payables"
          value={formatMoney(summary.payables)}
          tone="red"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="text-amber-600" size={20} />
          <h2 className="font-semibold text-slate-900">Low Stock Alerts</h2>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {lowStockProducts.length}
          </span>
        </div>

        {lowStockProducts.length === 0 ? (
          <p className="py-5 text-center text-sm text-slate-500">
            No low-stock products.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {lowStockProducts.map((product) => (
              <li
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.sku}</p>
                </div>
                <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">
                  {product.stock_quantity} in stock · threshold{" "}
                  {product.low_stock_threshold}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-900">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/transactions?mode=purchase"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <ArrowDownLeft size={17} />
            Stock IN
          </Link>
          <Link
            to="/transactions?mode=sale"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            <ArrowUpRight size={17} />
            Stock OUT
          </Link>
          <Link
            to="/inventory?action=add"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Package size={17} />
            Add Product
          </Link>
        </div>
      </section>
    </div>
  );
}