"use client";

import { useEffect, useRef, useState } from "react";

interface Category {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
}

interface TxType {
  id: string;
  name: string;
  appliesTo: "INCOME" | "EXPENSE" | "BOTH";
}

export interface TransactionFormData {
  id?: string;
  direction: "INCOME" | "EXPENSE";
  amount: string;
  categoryId: string;
  typeId: string;
  description: string;
  occurredAt: string;
  recurrence: "" | "WEEKLY" | "MONTHLY" | "YEARLY";
}

interface Props {
  open: boolean;
  initial?: TransactionFormData | null;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm = (): TransactionFormData => ({
  direction: "EXPENSE",
  amount: "",
  categoryId: "",
  typeId: "",
  description: "",
  occurredAt: new Date().toISOString().slice(0, 10),
  recurrence: "",
});

export default function TransactionModal({ open, initial, onClose, onSaved }: Props) {
  const [form, setForm] = useState<TransactionFormData>(emptyForm());
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TxType[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const firstInput = useRef<HTMLInputElement>(null);
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [catError, setCatError] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);

  const reloadCategories = () => fetch("/api/category").then((r) => r.json()).then(setCategories);

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? emptyForm());
    setError("");
    setShowNewCat(false);
    setNewCatName("");
    setCatError("");
    reloadCategories();
    fetch("/api/type").then((r) => r.json()).then(setTypes);
    setTimeout(() => firstInput.current?.focus(), 50);
  }, [open, initial]);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setAddingCat(true);
    setCatError("");
    const res = await fetch("/api/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim(), direction: form.direction }),
    });
    const data = await res.json();
    if (!res.ok) { setCatError(data.error ?? "Failed"); setAddingCat(false); return; }
    await reloadCategories();
    setForm((prev) => ({ ...prev, categoryId: data.id }));
    setNewCatName("");
    setShowNewCat(false);
    setAddingCat(false);
  }

  const filteredCategories = categories.filter((c) => c.direction === form.direction);
  const filteredTypes = types.filter(
    (t) => t.appliesTo === "BOTH" || t.appliesTo === form.direction
  );

  function set(field: keyof TransactionFormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Reset categoryId when direction changes if it no longer matches
      if (field === "direction") {
        const valid = categories.some((c) => c.id === prev.categoryId && c.direction === value);
        if (!valid) next.categoryId = "";
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.categoryId) {
      setError("Amount and category are required.");
      return;
    }
    setSaving(true);
    setError("");

    const payload = {
      amount: parseFloat(form.amount),
      direction: form.direction,
      categoryId: form.categoryId,
      typeId: form.typeId || null,
      description: form.description || null,
      occurredAt: form.occurredAt,
      recurrence: form.recurrence || null,
    };

    try {
      const url = form.id ? `/api/transactions/${form.id}` : "/api/transactions";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {form.id ? "Edit Transaction" : "New Transaction"}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Direction toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {(["EXPENSE", "INCOME"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("direction", d)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.direction === d
                    ? d === "INCOME"
                      ? "bg-emerald-500 text-white"
                      : "bg-red-500 text-white"
                    : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {d === "INCOME" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Amount (€)
            </label>
            <input
              ref={firstInput}
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => set("amount", e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Category
            </label>
            <select
              value={form.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              required
            >
              <option value="">Select category…</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => { setShowNewCat((v) => !v); setCatError(""); setNewCatName(""); }}
              className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New {form.direction === "INCOME" ? "income" : "expense"} category
            </button>

            {showNewCat && (
              <div className="mt-2 flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder={`e.g. ${form.direction === "INCOME" ? "Salary" : "Groceries"}`}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={addingCat || !newCatName.trim()}
                  className="px-3 py-1.5 text-sm rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors"
                >
                  {addingCat ? "…" : "Add"}
                </button>
              </div>
            )}
            {catError && <p className="text-xs text-red-500 mt-1">{catError}</p>}
          </div>

          {/* Type (optional) */}
          {filteredTypes.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Type <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <select
                value={form.typeId}
                onChange={(e) => set("typeId", e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              >
                <option value="">No type</option>
                {filteredTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Description <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Supermarket, Netflix…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Date
            </label>
            <input
              type="date"
              value={form.occurredAt}
              onChange={(e) => set("occurredAt", e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              required
            />
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Repeat <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2 flex-wrap">
              {([["", "Once"], ["WEEKLY", "Weekly"], ["MONTHLY", "Monthly"], ["YEARLY", "Yearly"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set("recurrence", val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.recurrence === val
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.recurrence && (
              <p className="text-xs text-slate-400 mt-1.5">
                A new transaction will be created automatically every {form.recurrence.toLowerCase()} from the selected date.
              </p>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : form.id ? "Save Changes" : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
