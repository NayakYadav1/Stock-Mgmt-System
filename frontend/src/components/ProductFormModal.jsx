import { useState } from "react";
import { productsApi } from "../services/api.js";
import { useToast } from "./ui.jsx";
import {
  Field,
  Modal,
  Spinner,
  btnGhost,
  btnPrimary,
  inputCls,
} from "./ui.jsx";

export default function ProductFormModal({ product, onClose, onSaved }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    cost_price: product?.cost_price ?? "",
    selling_price: product?.selling_price ?? "",
    low_stock_threshold: product?.low_stock_threshold ?? 5,
  });

  const setField = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();

    const validPrice = (value) =>
      /^\d{1,10}(\.\d{1,2})?$/.test(String(value)) &&
      Number.isFinite(Number(value));

    if (!form.sku.trim()) return toast("error", "SKU is required");
    if (!form.name.trim()) return toast("error", "Product name is required");
    if (!validPrice(form.cost_price) || !validPrice(form.selling_price)) {
      return toast("error", "Enter valid prices with up to 2 decimal places");
    }
    if (
      !Number.isSafeInteger(Number(form.low_stock_threshold)) ||
      Number(form.low_stock_threshold) < 0
    ) {
      return toast("error", "Low-stock threshold must be a non-negative integer");
    }

    const body = {
      sku: form.sku.trim(),
      name: form.name.trim().replace(/\s+/g, " "),
      cost_price: Number(form.cost_price),
      selling_price: Number(form.selling_price),
      low_stock_threshold: Number(form.low_stock_threshold),
    };

    setBusy(true);
    try {
      const result = product
        ? await productsApi.update(product.id, body)
        : await productsApi.create(body);

      toast("success", result.message || "Product saved");
      await onSaved();
      onClose();
    } catch (error) {
      toast("error", error.message || "Could not save product");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={product ? "Edit Product" : "Add New Product"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="SKU *">
          <input
            className={inputCls}
            value={form.sku}
            onChange={setField("sku")}
            maxLength={100}
            required
          />
        </Field>

        <Field label="Product name *">
          <input
            className={inputCls}
            value={form.name}
            onChange={setField("name")}
            maxLength={200}
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cost price *">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.cost_price}
              onChange={setField("cost_price")}
              required
            />
          </Field>
          <Field label="Selling price *">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputCls}
              value={form.selling_price}
              onChange={setField("selling_price")}
              required
            />
          </Field>
        </div>

        <Field label="Low-stock alert threshold">
          <input
            type="number"
            min="0"
            step="1"
            className={inputCls}
            value={form.low_stock_threshold}
            onChange={setField("low_stock_threshold")}
            required
          />
        </Field>

        {!product && (
          <p className="text-xs text-slate-500">
            New products start at zero stock. Use a Stock IN transaction to add
            inventory.
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            className={btnGhost}
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy && <Spinner />}
            {product ? "Save Changes" : "Create Product"}
          </button>
        </div>
      </form>
    </Modal>
  );
}