import { Plus, PackagePlus, Trash2, AlertTriangle } from "lucide-react";
import { inputCls, btnGhost } from "./ui.jsx";
import { formatMoney, minAllowedPrice } from "../utils.js";

// One empty row. "price" means unit cost in Stock IN and selling price in Stock OUT.
export const emptyRow = () => ({ product_id: "", quantity: 1, price: "" });

// Checks one row. Used here for display and by the pages before submitting.
export function rowIssues(row, product, isSale) {
  if (!product) return { error: null, warning: null };
  let error = null;
  let warning = null;

  if (isSale && Number(row.quantity) > product.stock_quantity) {
    error = `Only ${product.stock_quantity} in stock`;
  }
  if (
    isSale &&
    row.price !== "" &&
    Number(row.price) < minAllowedPrice(product)
  ) {
    warning = `Selling price is below the cost price (${formatMoney(minAllowedPrice(product))}). You will make a loss.`;
  }
  return { error, warning };
}

export default function LineItems({
  products,
  rows,
  setRows,
  mode,
  onNewProduct,
}) {
  const isSale = mode === "sale";

  const updateRow = (index, changes) =>
    setRows((list) =>
      list.map((r, i) => (i === index ? { ...r, ...changes } : r)),
    );

  const pickProduct = (index, id) => {
    const product = products.find((p) => String(p.id) === id);
    let price = "";
    if (product) {
      price = isSale ? product.selling_price : minAllowedPrice(product);
    }
    updateRow(index, { product_id: id, price });
  };

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const product = products.find(
          (p) => String(p.id) === String(row.product_id),
        );
        const { error, warning } = rowIssues(row, product, isSale);
        const lineTotal =
          (Number(row.quantity) || 0) * (Number(row.price) || 0);

        return (
          <div
            key={index}
            className="rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-12 sm:items-end">
              <label className="col-span-2 sm:col-span-5">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Product
                </span>
                <select
                  className={inputCls}
                  value={row.product_id}
                  onChange={(e) => pickProduct(index, e.target.value)}
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={isSale && p.stock_quantity <= 0}
                    >
                      {p.name} ({p.sku})
                      {isSale ? ` - Stock: ${p.stock_quantity}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Quantity
                </span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className={`${inputCls} ${error ? "border-red-400" : ""}`}
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(index, { quantity: e.target.value })
                  }
                />
              </label>

              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  {isSale ? "Selling price" : "Unit cost"}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={`${inputCls} ${warning ? "border-amber-400" : ""}`}
                  value={row.price}
                  onChange={(e) => updateRow(index, { price: e.target.value })}
                />
              </label>

              <div className="col-span-2 flex items-center justify-between sm:col-span-3">
                <div>
                  <span className="block text-xs font-medium text-slate-600">
                    Row total
                  </span>
                  <span className="text-sm font-semibold text-slate-900">
                    {formatMoney(lineTotal)}
                  </span>
                </div>
                <button
                  type="button"
                  title="Remove row"
                  disabled={rows.length === 1}
                  onClick={() =>
                    setRows((list) => list.filter((_, i) => i !== index))
                  }
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50 disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangle size={14} /> {error}
              </p>
            )}
            {warning && (
              <p className="mt-2 flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                <AlertTriangle size={14} /> {warning}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={btnGhost}
          onClick={() => setRows((list) => [...list, emptyRow()])}
        >
          <Plus size={16} /> Add Item
        </button>
        {onNewProduct && (
          <button type="button" className={btnGhost} onClick={onNewProduct}>
            <PackagePlus size={16} /> Create New Product
          </button>
        )}
      </div>
    </div>
  );
}
