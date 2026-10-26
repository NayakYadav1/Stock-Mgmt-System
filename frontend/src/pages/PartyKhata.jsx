import { useCallback, useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { partiesApi } from "../services/api.js";
import { formatMoney } from "../utils.js";
import {
  btnGhost,
  btnPrimary,
  Field,
  inputCls,
  Modal,
  useToast,
} from "../components/ui.jsx";

const emptyForm = () => ({
  party_type: "customer",
  name: "",
  phone: "",
  address: "",
});

export default function PartyKhata() {
  const toast = useToast();
  const [filter, setFilter] = useState("all");
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setParties(await partiesApi.getAll(filter === "all" ? undefined : filter));
    } catch (err) {
      setError(err.message || "Could not load parties");
      toast("error", err.message || "Could not load parties");
    } finally {
      setLoading(false);
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const result = await partiesApi.create({
        party_type: form.party_type,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });

      toast("success", result.message || "Party added");
      setForm(emptyForm());
      setFormOpen(false);
      await load();
    } catch (err) {
      toast("error", err.message || "Could not add party");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Party Khata</h1>
          <p className="mt-1 text-sm text-slate-500">
            Customers, suppliers, and their outstanding balances.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className={btnPrimary}
        >
          <Plus size={17} />
          Add party
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          ["all", "All parties"],
          ["customer", "Customers"],
          ["supplier", "Suppliers"],
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
          Loading parties...
        </p>
      )}

      {!loading && error && (
        <section className="rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={load} className={`${btnGhost} mt-3`}>
            Try again
          </button>
        </section>
      )}

      {!loading && !error && parties.length === 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Users className="mx-auto text-slate-400" size={28} />
          <p className="mt-3 font-medium text-slate-800">No parties yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add a customer or supplier to get started.
          </p>
        </section>
      )}

      {!loading && !error && parties.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {parties.map((party) => {
            const balance = Number(party.balance) || 0;
            const balanceLabel =
              balance > 0 ? "Receivable" : balance < 0 ? "Payable" : "Settled";
            const balanceTone =
              balance > 0
                ? "text-emerald-700"
                : balance < 0
                  ? "text-rose-700"
                  : "text-slate-600";

            return (
              <article
                key={party.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-slate-900">
                      {party.name}
                    </h2>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {party.party_type}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      balance > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : balance < 0
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {balanceLabel}
                  </span>
                </div>

                {party.phone && (
                  <p className="mt-3 text-sm text-slate-600">{party.phone}</p>
                )}
                {party.address && (
                  <p className="mt-1 text-sm text-slate-500">{party.address}</p>
                )}

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Outstanding balance
                  </p>
                  <p className={`mt-1 text-xl font-bold ${balanceTone}`}>
                    {formatMoney(Math.abs(balance))}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {formOpen && (
        <Modal
          title="Add party"
          onClose={() => {
            setFormOpen(false);
            setForm(emptyForm());
          }}
        >
          <form onSubmit={submit} className="space-y-4">
            <Field label="Party type *">
              <select
                className={inputCls}
                value={form.party_type}
                onChange={(event) =>
                  setForm({ ...form, party_type: event.target.value })
                }
              >
                <option value="customer">Customer</option>
                <option value="supplier">Supplier</option>
                <option value="both">Both</option>
              </select>
            </Field>

            <Field label="Name *">
              <input
                className={inputCls}
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                maxLength="200"
                required
              />
            </Field>

            <Field label="Phone">
              <input
                className={inputCls}
                type="tel"
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                maxLength="30"
              />
            </Field>

            <Field label="Address">
              <input
                className={inputCls}
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setForm(emptyForm());
                }}
                className={btnGhost}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className={btnPrimary} disabled={saving}>
                {saving ? "Saving..." : "Save party"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}