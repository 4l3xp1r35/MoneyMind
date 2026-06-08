"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
}

interface Transaction {
  id: string;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  description: string | null;
  occurredAt: string;
  category: { id: string; name: string };
}

type SheetMode = null | { type: "add"; direction: "INCOME" | "EXPENSE" } | { type: "edit"; tx: Transaction };

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}

function groupByDate(txs: Transaction[]) {
  const map: Record<string, Transaction[]> = {};
  for (const tx of txs) {
    const key = tx.occurredAt.slice(0, 10);
    (map[key] ??= []).push(tx);
  }
  return map;
}

// ── Entry Sheet ────────────────────────────────────────────────────────────────
interface SheetProps {
  mode: SheetMode;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

function EntrySheet({ mode, categories, onClose, onSaved }: SheetProps) {
  const isEdit = mode?.type === "edit";
  const tx = isEdit ? (mode as { type: "edit"; tx: Transaction }).tx : null;
  const initDir: "INCOME" | "EXPENSE" =
    tx?.direction ?? (mode as { type: "add"; direction: "INCOME" | "EXPENSE" })?.direction ?? "EXPENSE";

  const [direction, setDirection] = useState<"INCOME" | "EXPENSE">(initDir);
  const [amount, setAmount]       = useState(tx ? tx.amount.toFixed(2) : "");
  const [categoryId, setCatId]    = useState(tx?.category.id ?? "");
  const [description, setDesc]    = useState(tx?.description ?? "");
  const [date, setDate]           = useState(
    tx ? tx.occurredAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const filteredCats = categories.filter((c) => c.direction === direction);

  // reset category when direction changes
  useEffect(() => {
    if (!filteredCats.find((c) => c.id === categoryId)) {
      setCatId(filteredCats[0]?.id ?? "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction]);

  async function save() {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return setError("Enter a valid amount.");
    if (!categoryId) return setError("Select a category.");
    setSaving(true);
    try {
      const url    = isEdit ? `/api/transactions/${tx!.id}` : "/api/transactions";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amt,
          direction,
          categoryId,
          description: description.trim() || null,
          occurredAt: date,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to save");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const isExpense = direction === "EXPENSE";

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 rounded-t-3xl px-5 pt-4 pb-8 shadow-2xl"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>

        {/* drag handle */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-5" />

        {/* direction toggle (only for new entries) */}
        {!isEdit && (
          <div className="flex rounded-2xl overflow-hidden mb-5 border border-slate-700">
            {(["EXPENSE", "INCOME"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${
                  direction === d
                    ? d === "EXPENSE"
                      ? "bg-red-500 text-white"
                      : "bg-emerald-500 text-white"
                    : "text-slate-500 bg-slate-800"
                }`}
              >
                {d === "EXPENSE" ? "− Expense" : "+ Income"}
              </button>
            ))}
          </div>
        )}

        {/* Amount */}
        <div className={`flex items-center justify-center gap-2 mb-5 px-4 py-4 rounded-2xl ${
          isExpense ? "bg-red-950/40" : "bg-emerald-950/40"
        }`}>
          <span className={`text-3xl font-bold ${isExpense ? "text-red-400" : "text-emerald-400"}`}>€</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className={`w-full text-4xl font-bold bg-transparent outline-none text-center ${
              isExpense ? "text-red-300 placeholder-red-900" : "text-emerald-300 placeholder-emerald-900"
            }`}
          />
        </div>

        {/* Category */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {filteredCats.map((c) => (
              <button
                key={c.id}
                onClick={() => setCatId(c.id)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  categoryId === c.id
                    ? isExpense
                      ? "bg-red-500 text-white"
                      : "bg-emerald-500 text-white"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Note + Date */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Note</label>
            <input
              type="text"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm placeholder-slate-600 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-3">{error}</p>
        )}

        {/* Save */}
        <button
          onClick={save}
          disabled={saving}
          className={`w-full py-4 rounded-2xl text-white font-bold text-lg transition-colors disabled:opacity-50 ${
            isExpense ? "bg-red-500 active:bg-red-600" : "bg-emerald-500 active:bg-emerald-600"
          }`}
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : isExpense ? "Add Expense" : "Add Income"}
        </button>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MobilePage() {
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories]     = useState<Category[]>([]);
  const [loading, setLoading]           = useState(true);
  const [sheet, setSheet]               = useState<SheetMode>(null);
  const [deleteId, setDeleteId]         = useState<string | null>(null);
  const [deleting, setDeleting]         = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, catRes] = await Promise.all([
        fetch("/api/transactions?limit=50"),
        fetch("/api/category"),
      ]);
      if (txRes.ok)  setTransactions((await txRes.json()).transactions ?? []);
      if (catRes.ok) setCategories(await catRes.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      setDeleteId(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  // ── not logged in ────────────────────────────────────────────────────────────
  if (status === "unauthenticated") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-5xl">💰</div>
        <h1 className="text-2xl font-bold text-white">MoneyMind</h1>
        <p className="text-slate-400 text-sm text-center">Sign in to track your finances</p>
        <button
          onClick={() => signIn(undefined, { callbackUrl: "/mobile" })}
          className="w-full max-w-xs py-4 rounded-2xl bg-emerald-500 text-white font-bold text-lg active:bg-emerald-600"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading…</div>
      </div>
    );
  }

  // ── month summary ────────────────────────────────────────────────────────────
  const now = new Date();
  const monthTxs = transactions.filter((tx) => {
    const d = new Date(tx.occurredAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income  = monthTxs.filter((t) => t.direction === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.direction === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const grouped = groupByDate(transactions);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div
      className="min-h-screen bg-slate-950 text-white flex flex-col"
      style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}
    >
      {/* ── Header ── */}
      <div
        className="bg-slate-900 px-5 pt-4 pb-5"
        style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <span className="font-bold text-slate-100">MoneyMind</span>
          </div>
          <span className="text-xs text-slate-500">
            {now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
        </div>

        {/* Balance card */}
        <div className="bg-slate-800 rounded-2xl px-4 py-4">
          <p className="text-xs text-slate-400 mb-1">Balance this month</p>
          <p className={`text-3xl font-bold tabular-nums ${balance >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {balance >= 0 ? "+" : ""}€{Math.abs(balance).toFixed(2)}
          </p>
          <div className="flex gap-4 mt-3">
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Income</p>
              <p className="text-sm font-semibold text-emerald-400 tabular-nums">+€{income.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 mb-0.5">Expenses</p>
              <p className="text-sm font-semibold text-red-400 tabular-nums">−€{expense.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Transaction List ── */}
      <div className="flex-1 px-4 pt-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">💸</div>
            <p className="text-slate-500 text-sm">No transactions yet</p>
            <p className="text-slate-600 text-xs mt-1">Tap the buttons below to add one</p>
          </div>
        ) : (
          <div className="space-y-5">
            {sortedDates.map((date) => (
              <div key={date}>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-1">
                  {formatDateLabel(date)}
                </p>
                <div className="space-y-2">
                  {grouped[date].map((tx) => (
                    <div key={tx.id}>
                      {/* Transaction row */}
                      <div
                        className="flex items-center gap-3 bg-slate-900 rounded-2xl px-4 py-3 active:bg-slate-800 transition-colors"
                        onClick={() => {
                          if (deleteId === tx.id) {
                            setDeleteId(null);
                          } else {
                            setSheet({ type: "edit", tx });
                          }
                        }}
                      >
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold ${
                          tx.direction === "INCOME"
                            ? "bg-emerald-950/60 text-emerald-400"
                            : "bg-red-950/60 text-red-400"
                        }`}>
                          {tx.direction === "INCOME" ? "+" : "−"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {tx.description ?? tx.category.name}
                          </p>
                          <p className="text-xs text-slate-500">{tx.category.name}</p>
                        </div>

                        {/* Amount */}
                        <p className={`text-sm font-bold tabular-nums shrink-0 ${
                          tx.direction === "INCOME" ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {tx.direction === "INCOME" ? "+" : "−"}€{tx.amount.toFixed(2)}
                        </p>

                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(deleteId === tx.id ? null : tx.id);
                          }}
                          className="ml-1 p-1.5 rounded-lg text-slate-600 active:text-red-400"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>

                      {/* Delete confirm */}
                      {deleteId === tx.id && (
                        <div className="flex gap-2 mt-1 px-1">
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deleting}
                            className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold active:bg-red-600 disabled:opacity-50"
                          >
                            {deleting ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            onClick={() => setDeleteId(null)}
                            className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-sm font-medium active:bg-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bottom Action Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 flex gap-3 px-4 py-3 bg-slate-950 border-t border-slate-800"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => setSheet({ type: "add", direction: "EXPENSE" })}
          className="flex-1 py-4 rounded-2xl bg-red-500 text-white font-bold text-base active:bg-red-600 transition-colors"
        >
          − Expense
        </button>
        <button
          onClick={() => setSheet({ type: "add", direction: "INCOME" })}
          className="flex-1 py-4 rounded-2xl bg-emerald-500 text-white font-bold text-base active:bg-emerald-600 transition-colors"
        >
          + Income
        </button>
      </div>

      {/* ── Entry Sheet ── */}
      {sheet && (
        <EntrySheet
          mode={sheet}
          categories={categories}
          onClose={() => setSheet(null)}
          onSaved={() => { setSheet(null); load(); }}
        />
      )}
    </div>
  );
}
