"use client";

import { useCallback, useEffect, useState } from "react";
import BudgetCard from "@/components/budget/BudgetCard";
import BudgetModal from "@/components/budget/BudgetModal";

interface BudgetItem {
  categoryId: string;
  categoryName: string;
  budgetId: string | null;
  limit: number | null;
  spent: number;
  remaining: number | null;
  percentage: number | null;
  status: "ok" | "warning" | "over" | "unset";
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function BudgetPage() {
  const [month, setMonth] = useState(currentMonth());
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState<BudgetItem | null>(null);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget?month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
      }
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  async function handleDelete(budgetId: string) {
    await fetch(`/api/budget?id=${budgetId}`, { method: "DELETE" });
    fetchBudgets();
  }

  // Summary stats
  const budgeted = items.filter((i) => i.limit !== null);
  const totalLimit = budgeted.reduce((s, i) => s + (i.limit ?? 0), 0);
  const totalSpent = budgeted.reduce((s, i) => s + i.spent, 0);
  const overCount = items.filter((i) => i.status === "over").length;
  const warningCount = items.filter((i) => i.status === "warning").length;

  const sorted = [...items].sort((a, b) => {
    const order = { over: 0, warning: 1, ok: 2, unset: 3 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Budget Planner</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set monthly limits per category</p>
        </div>
        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth(prevMonth(month))}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 min-w-[140px] text-center">
            {monthLabel(month)}
          </span>
          <button
            onClick={() => setMonth(nextMonth(month))}
            disabled={month >= currentMonth()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {!loading && budgeted.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Total Budget</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{fmt(totalLimit)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Total Spent</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{fmt(totalSpent)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Remaining</p>
            <p className={`text-lg font-bold ${totalLimit - totalSpent >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
              {fmt(totalLimit - totalSpent)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">Alerts</p>
            <p className="text-lg font-bold">
              {overCount > 0 && <span className="text-red-500">{overCount} over</span>}
              {overCount > 0 && warningCount > 0 && <span className="text-slate-400"> · </span>}
              {warningCount > 0 && <span className="text-amber-500">{warningCount} near</span>}
              {overCount === 0 && warningCount === 0 && <span className="text-emerald-500">All good</span>}
            </p>
          </div>
        </div>
      )}

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm text-slate-500">No expense categories yet.</p>
          <p className="text-xs text-slate-400 mt-1">Add categories from the Transactions page first.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((item) => (
            <BudgetCard
              key={item.categoryId}
              item={item}
              onEdit={setModalItem}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <BudgetModal
        open={!!modalItem}
        item={modalItem}
        month={month}
        onClose={() => setModalItem(null)}
        onSaved={fetchBudgets}
      />
    </div>
  );
}
