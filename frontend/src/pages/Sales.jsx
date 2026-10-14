import { useEffect, useState, useCallback } from "react";
import { Receipt } from "lucide-react";
import { productsApi, salesApi } from "../services/api.js";
import { formatMoney, todayISO } from "../utils.js";
import TransactionList from "../components/TransactionList.jsx";
import {
  Card,
  Field,
  StatusBadge,
  PageLoader,
  Spinner,
  useToast,
  inputCls,
  btnPrimary,
} from "../components/ui.jsx";
import LineItems, { emptyRow, rowIssues } from "../components/LineItems.jsx";

const emptyHeader = () => ({
  customer_name: "",
  customer_phone: "",
  sold_by: "",
  sale_date: todayISO(),
  notes: "",
});

export default function Sales() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState(emptyHeader());
  const [rows, setRows] = useState([emptyRow()]);
  const [paid, setPaid] = useState("");

  const load = useCallback(async () => {
    try {
      const [prods, sales] = await Promise.all([
        productsApi.getAll(),
        salesApi.getAll(),
      ]);
      setProducts(prods);
      setHistory(sales);
    } catch (e) {
      toast("error", e.message);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Live payment summary
  const grandTotal = rows.reduce(
    (sum, r) => sum + (Number(r.quantity) || 0) * (Number(r.price) || 0),
    0,
  );
  const paidNum = Number(paid) || 0;
  const remaining = Math.max(grandTotal - paidNum, 0);
  const status =
    grandTotal > 0 && paidNum >= grandTotal
      ? "PAID"
      : paidNum > 0
        ? "PARTIAL"
        : "DUE";

  const findProduct = (id) => products.find((p) => String(p.id) === String(id));

  const submit = async () => {
    if (!header.customer_name.trim())
      return toast("error", "Customer name is required");
    if (!header.sold_by.trim()) return toast("error", "Sold By is required");
    if (!header.sale_date) return toast("error", "Sale date is required");

    for (const r of rows) {
      if (!r.product_id) return toast("error", "Select a product on every row");
      if (!(Number(r.quantity) > 0) || !Number.isInteger(Number(r.quantity)))
        return toast("error", "Quantity must be a whole number greater than 0");
      if (r.price === "" || Number(r.price) < 0)
        return toast("error", "Enter a valid selling price on every row");
    }

    // Stock check (adds up the same product if it appears on more than one row)
    const used = {};
    for (const r of rows)
      used[r.product_id] = (used[r.product_id] || 0) + Number(r.quantity);
    for (const id in used) {
      const p = findProduct(id);
      if (used[id] > p.stock_quantity)
        return toast(
          "error",
          `${p.name}: only ${p.stock_quantity} in stock, but ${used[id]} requested`,
        );
    }

    if (paidNum < 0) return toast("error", "Amount paid cannot be negative");
    if (paidNum > grandTotal)
      return toast("error", "Amount paid cannot be more than the grand total");

    const belowCost = rows.some(
      (r) => rowIssues(r, findProduct(r.product_id), true).warning,
    );
    if (
      belowCost &&
      !window.confirm(
        "Some items are priced below cost. Do you want to continue?",
      )
    )
      return;

    const body = {
      customer_name: header.customer_name.trim(),
      sold_by: header.sold_by.trim(),
      sale_date: header.sale_date,
      amount_paid: paidNum,
      notes: header.notes.trim(),
      items: rows.map((r) => ({
        product_id: Number(r.product_id),
        quantity: Number(r.quantity),
        selling_price: Number(r.price),
      })),
    };
    if (header.customer_phone.trim())
      body.customer_phone = header.customer_phone.trim();

    setBusy(true);
    try {
      const res = await salesApi.create(body);
      toast("success", res.message || "Sale recorded successfully");
      setHeader(emptyHeader());
      setRows([emptyRow()]);
      setPaid("");
      load();
    } catch (err) {
      toast("error", err.message);
    }
    setBusy(false);
  };

  if (loading) return <PageLoader />;

  const setField = (key) => (e) =>
    setHeader({ ...header, [key]: e.target.value });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Stock OUT - Sale / Invoice</h1>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Customer name *">
            <input
              className={inputCls}
              value={header.customer_name}
              onChange={setField("customer_name")}
            />
          </Field>
          <Field label="Customer phone">
            <input
              type="tel"
              className={inputCls}
              value={header.customer_phone}
              onChange={setField("customer_phone")}
            />
          </Field>
          <Field label="Sold By *">
            <input
              className={inputCls}
              value={header.sold_by}
              onChange={setField("sold_by")}
            />
          </Field>
          <Field label="Sale date *">
            <input
              type="date"
              max={todayISO()}
              className={inputCls}
              value={header.sale_date}
              onChange={setField("sale_date")}
            />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <input
              className={inputCls}
              value={header.notes}
              onChange={setField("notes")}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Items</h2>
        <LineItems
          mode="sale"
          products={products}
          rows={rows}
          setRows={setRows}
        />
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">Payment Summary</h2>
        <div className="grid gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <p className="text-xs uppercase text-slate-500">Grand Total</p>
            <p className="text-2xl font-bold">{formatMoney(grandTotal)}</p>
          </div>
          <Field label="Cash / Amount paid now">
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              className={`${inputCls} ${paidNum > grandTotal ? "border-red-400" : ""}`}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </Field>
          <div>
            <p className="text-xs uppercase text-slate-500">Remaining Due</p>
            <p
              className={`text-2xl font-bold ${remaining > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {formatMoney(remaining)}
            </p>
          </div>
          <div>{grandTotal > 0 && <StatusBadge status={status} />}</div>
        </div>
        {paidNum > grandTotal && (
          <p className="text-xs font-medium text-red-600">
            Amount paid is more than the grand total.
          </p>
        )}
        <button
          className={`${btnPrimary} w-full py-3 sm:w-auto`}
          disabled={busy}
          onClick={submit}
        >
          {busy ? <Spinner /> : <Receipt size={18} />} Finalize Sale
        </button>
      </Card>

      {/* Sales history */}
      <Card>
        <h2 className="mb-4 font-semibold">Sales History</h2>
        <TransactionList
          type="sale"
          items={history}
          emptyText="No sales yet."
        />
      </Card>
    </div>
  );
}
