import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { productsApi } from "../services/api.js";
import { formatMoney } from "../utils.js";
import { useToast } from "../components/ui.jsx";
import { Modal, btnDanger, btnPrimary } from "../components/ui.jsx";
import ProductFormModal from "../components/ProductFormModal.jsx";

export default function Inventory() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setProducts(await productsApi.getAll());
    } catch (err) {
      setError(err.message || "Could not load products");
      toast("error", err.message || "Could not load products");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setAddingProduct(true);
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          next.delete("action");
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, setSearchParams]);

  const term = search.trim().toLowerCase();
  const filtered = products.filter((product) =>
    `${product.name} ${product.sku}`.toLowerCase().includes(term),
  );

  const confirmDelete = async () => {
    setBusy(true);
    try {
      const result = await productsApi.remove(deletingProduct.id);
      toast("success", result.message || "Product deleted");
      setDeletingProduct(null);
      await load();
    } catch (err) {
      toast("error", err.message || "Could not delete product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">
            Search, add, and manage your products.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingProduct(true)}
          className={btnPrimary}
        >
          <Plus size={17} />
          Add New Product
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <span className="sr-only">Search products by name or SKU</span>
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by product name or SKU..."
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </label>
        <p className="mt-3 text-xs text-slate-500">
          Showing {filtered.length} of {products.length} products
        </p>
      </section>

      {loading && (
        <p className="py-10 text-center text-sm text-slate-500">
          Loading inventory...
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

      {!loading && !error && filtered.length === 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-800">
            {products.length === 0 ? "No products yet" : "No matching products"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {products.length === 0
              ? "Add a product to get started."
              : "Try a different product name or SKU."}
          </p>
        </section>
      )}

      {!loading && !error && filtered.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Cost Price</th>
                  <th className="px-4 py-3 text-right">Selling Price</th>
                  <th className="px-4 py-3 text-right">Current Stock</th>
                  <th className="px-4 py-3 text-right">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((product) => {
                  const isLow =
                    product.stock_quantity <= product.low_stock_threshold;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {product.name}
                        </p>
                        <span className="mt-1 inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                          {product.sku}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(product.cost_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {formatMoney(product.selling_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {product.stock_quantity}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isLow
                              ? "bg-rose-50 text-rose-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {isLow ? "Low stock" : "In stock"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          title="Edit product"
                          onClick={() => setEditingProduct(product)}
                          className="rounded p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          type="button"
                          title="Delete product"
                          onClick={() => setDeletingProduct(product)}
                          className="rounded p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {addingProduct && (
        <ProductFormModal
          onClose={() => setAddingProduct(false)}
          onSaved={load}
        />
      )}

      {editingProduct && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={load}
        />
      )}

      {deletingProduct && (
        <Modal
          title="Delete Product"
          onClose={() => !busy && setDeletingProduct(null)}
        >
          <p className="text-sm text-slate-600">
            Delete <strong>{deletingProduct.name}</strong>? Products referenced
            by transaction history cannot be deleted.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingProduct(null)}
              disabled={busy}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className={btnDanger}
            >
              {busy ? "Deleting..." : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}