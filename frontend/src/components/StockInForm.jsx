import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { partiesApi, productsApi, transactionsApi } from "../services/api.js";
import { formatMoney } from "../utils.js";
import { useToast } from "./ui.jsx";

const emptyItem = () => ({
  product_id: "",
  quantity: "1",
  unit_price: "",
});

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function StockInForm({ onSaved }) {
  const toast = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [items, setItems] = useState([emptyItem()]);
  const [paymentMode, setPaymentMode] = useState("paid");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [supplierList, productList] = await Promise.all([
          partiesApi.getAll("supplier"),
          productsApi.getAll(),
        ]);
        setSuppliers(supplierList);
        setProducts(productList);
      } catch (err) {
        toast("error", err.message || "Could not load suppliers and products");
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [toast]);

  const updateItem = (index, changes) => {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item,
      ),
    );
  };

  const selectProduct = (index, productId) => {
    const product = products.find((item) => String(item.id) === productId);
    updateItem(index, {
      product_id: productId,
      unit_price: product ? String(product.cost_price) : "",
    });
  };

  const total = items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0,
  );

  const submit = async (event) => {
    event.preventDefault();

    if (!partyId) {
      toast("error", "Select a supplier");
      return;
    }

    for (const item of items) {
      if (!item.product_id) {
        toast("error", "Select a product on every item row");
        return;
      }
      if (!Number.isSafeInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        toast("error", "Each quantity must be a whole number greater than 0");
        return;
      }
      if (item.unit_price === "" || !Number.isFinite(Number(item.unit_price)) || Number(item.unit_price) < 0) {
        toast("error", "Enter a valid unit cost for every item");
        return;
      }
    }

    const paid =
      paymentMode === "paid"
        ? total
        : paymentMode === "credit"
          ? 0
          : Number(amountPaid);

    if (paymentMode === "partial" && (!(paid > 0) || paid >= total)) {
      toast("error", "Partial payment must be greater than 0 and less than the total");
      return;
    }

    setBusy(true);
    try {
      const result = await transactionsApi.createPurchase({
        party_id: Number(partyId),
        items: items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
        amount_paid: paid,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      toast("success", result.message || "Stock IN recorded");
      setItems([emptyItem()]);
      setPartyId("");
      setPaymentMode("paid");
      setAmountPaid("");
      setReferenceNumber("");
      setNotes("");
      await onSaved();
    } catch (err) {
      toast("error", err.message || "Could not record Stock IN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Stock IN</h2>
        <p className="mt-1 text-sm text-slate-500">
          Record a purchase and increase product stock.
        </p>
      </div>

      {loading ? (
        <p className="py-4 text-sm text-slate-500">Loading suppliers and products...</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Supplier *
            </span>
            <select
              className={inputClass}
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              required
            >
              <option value="">Select supplier...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <span className="mt-1 block text-xs text-rose-600">
                Add a supplier in Party Khata before recording a purchase.
              </span>
            )}
          </label>

          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-12 sm:items-end"
              >
                <label className="sm:col-span-5">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Product *
                  </span>
                  <select
                    className={inputClass}
                    value={item.product_id}
                    onChange={(event) => selectProduct(index, event.target.value)}
                    required
                  >
                    <option value="">Select product...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Quantity *
                  </span>
                  <input
                    className={inputClass}
                    type="number"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, { quantity: event.target.value })
                    }
                    required
                  />
                </label>

                <label className="sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Unit cost *
                  </span>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) =>
                      updateItem(index, { unit_price: event.target.value })
                    }
                    required
                  />
                </label>

                <button
                  type="button"
                  title="Remove item"
                  disabled={items.length === 1}
                  onClick={() =>
                    setItems((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-40 sm:col-span-2"
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setItems((current) => [...current, emptyItem()])}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Plus size={16} />
            Add item
          </button>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Payment mode
              </span>
              <select
                className={inputClass}
                value={paymentMode}
                onChange={(event) => setPaymentMode(event.target.value)}
              >
                <option value="paid">Paid in full</option>
                <option value="credit">Credit / unpaid</option>
                <option value="partial">Partial payment</option>
              </select>
            </label>

            {paymentMode === "partial" && (
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Amount paid now *
                </span>
                <input
                  className={inputClass}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountPaid}
                  onChange={(event) => setAmountPaid(event.target.value)}
                  required
                />
              </label>
            )}

            {paymentMode !== "credit" && (
              <label>
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Payment method
                </span>
                <select
                  className={inputClass}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="fonepay">Fonepay</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="card">Card</option>
                  <option value="mobile_payment">Mobile payment</option>
                  <option value="other">Other</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Reference number
              </span>
              <input
                className={inputClass}
                value={referenceNumber}
                onChange={(event) => setReferenceNumber(event.target.value)}
                maxLength="100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Notes
              </span>
              <input
                className={inputClass}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <p className="text-lg font-bold text-slate-900">
              Purchase total: {formatMoney(total)}
            </p>
            <button
              type="submit"
              disabled={busy || suppliers.length === 0 || products.length === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={17} />
              {busy ? "Saving..." : "Record Stock IN"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}