import { useCallback, useEffect, useState } from "react";
import { paymentsApi, partiesApi } from "../services/api.js";
import { formatDate, formatMoney } from "../utils.js";
import { btnGhost, btnPrimary, Field, inputCls, Modal, useToast } from "./ui.jsx";

const paymentMethods = [
  ["cash", "Cash"],
  ["fonepay", "Fonepay"],
  ["bank_transfer", "Bank transfer"],
  ["card", "Card"],
  ["mobile_payment", "Mobile payment"],
  ["other", "Other"],
];

function entryLabel(entry) {
  if (entry.entry_type === "opening") return "Opening balance";
  if (entry.entry_type === "payment") {
    return entry.payment_direction === "received"
      ? "Payment received"
      : "Payment paid";
  }
  if (entry.transaction_type === "sale") return "Stock OUT / Sale";
  if (entry.transaction_type === "purchase") return "Stock IN / Purchase";
  return entry.entry_type;
}

export default function PartyLedgerModal({ party, onClose, onUpdated }) {
  const toast = useToast();
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      setLedger(await partiesApi.getLedger(party.id));
    } catch (err) {
      setError(err.message || "Could not load party ledger");
      toast("error", err.message || "Could not load party ledger");
    } finally {
      setLoading(false);
    }
  }, [party.id, toast]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const submitPayment = async (event) => {
    event.preventDefault();

    const paymentAmount = Number(amount);
    const outstanding = Math.abs(Number(ledger?.balance) || 0);

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      toast("error", "Enter a payment amount greater than 0");
      return;
    }

    if (paymentAmount > outstanding) {
      toast("error", "Payment cannot exceed the outstanding balance");
      return;
    }

    setSaving(true);
    try {
      const result = await paymentsApi.settle({
        party_id: Number(party.id),
        amount: paymentAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
      });

      toast("success", result.message || "Payment recorded");
      setAmount("");
      setReferenceNumber("");
      setNotes("");
      await loadLedger();
      await onUpdated();
    } catch (err) {
      toast("error", err.message || "Could not record payment");
    } finally {
      setSaving(false);
    }
  };

  const chronologicalEntries = [...(ledger?.entries || [])].reverse();
  let runningBalance = 0;
  const entriesWithBalance = chronologicalEntries.map((entry) => {
    runningBalance += Number(entry.amount) || 0;
    return { ...entry, runningBalance };
  });

  return (
    <Modal title={`${party.name} — Ledger`} onClose={onClose}>
      {loading && (
        <p className="py-6 text-center text-sm text-slate-500">
          Loading ledger...
        </p>
      )}

      {!loading && error && (
        <div className="space-y-3">
          <p className="text-sm text-rose-700">{error}</p>
          <button type="button" onClick={loadLedger} className={btnGhost}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && ledger && (
        <div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Current balance
            </p>
            <p
              className={`mt-1 text-xl font-bold ${
                ledger.balance > 0
                  ? "text-emerald-700"
                  : ledger.balance < 0
                    ? "text-rose-700"
                    : "text-slate-700"
              }`}
            >
              {ledger.balance > 0
                ? "Receivable: "
                : ledger.balance < 0
                  ? "Payable: "
                  : "Settled: "}
              {formatMoney(Math.abs(ledger.balance))}
            </p>
          </div>

          {ledger.balance !== 0 && (
            <form
              onSubmit={submitPayment}
              className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3"
            >
              <h3 className="font-semibold text-slate-900">
                {ledger.balance > 0 ? "Collect payment" : "Pay supplier"}
              </h3>

              <Field label="Amount *">
                <input
                  className={inputCls}
                  type="number"
                  min="0.01"
                  max={Math.abs(ledger.balance)}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </Field>

              <Field label="Payment method">
                <select
                  className={inputCls}
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                >
                  {paymentMethods.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reference number">
                <input
                  className={inputCls}
                  value={referenceNumber}
                  onChange={(event) => setReferenceNumber(event.target.value)}
                  maxLength="100"
                />
              </Field>

              <Field label="Notes">
                <input
                  className={inputCls}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </Field>

              <button
                type="submit"
                className={btnPrimary}
                disabled={saving}
              >
                {saving ? "Saving..." : "Record payment"}
              </button>
            </form>
          )}

          <section>
            <h3 className="mb-2 font-semibold text-slate-900">Ledger entries</h3>

            {entriesWithBalance.length === 0 ? (
              <p className="rounded-lg border border-slate-200 p-4 text-center text-sm text-slate-500">
                No ledger entries yet.
              </p>
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {[...entriesWithBalance].reverse().map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {entryLabel(entry)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(entry.created_at)}
                          {entry.transaction_id
                            ? ` · Transaction #${entry.transaction_id}`
                            : ""}
                          {entry.payment_method
                            ? ` · ${entry.payment_method.replaceAll("_", " ")}`
                            : ""}
                        </p>
                        {entry.reference_number && (
                          <p className="mt-1 text-xs text-slate-500">
                            Ref: {entry.reference_number}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.notes}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`font-semibold ${
                            entry.amount > 0
                              ? "text-emerald-700"
                              : entry.amount < 0
                                ? "text-rose-700"
                                : "text-slate-700"
                          }`}
                        >
                          {entry.amount > 0 ? "+" : entry.amount < 0 ? "−" : ""}
                          {formatMoney(Math.abs(entry.amount))}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Balance: {formatMoney(Math.abs(entry.runningBalance))}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}