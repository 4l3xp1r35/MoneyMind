"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

interface ReportData {
  currentMonth: { income: number; expenses: number; savings: number; savingsRate: number };
  topCategories: { name: string; amount: number; percentage: number }[];
  recentTransactions: { id: string; description: string; amount: number; direction: "INCOME" | "EXPENSE"; category: string; occurredAt: string }[];
}
interface BudgetItem { categoryName: string; limit: number | null; spent: number; status: string }
interface Holding { symbol: string; name: string; assetClass: string; quantity: number; avgCost: number }

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("default", { month: "long", year: "numeric" });
}

export default function ReportPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = use(params);
  const [data,     setData]     = useState<ReportData | null>(null);
  const [budget,   setBudget]   = useState<BudgetItem[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/dashboard?month=${month}`).then((r) => r.json()),
      fetch(`/api/budget?month=${month}`).then((r) => r.json()),
      fetch("/api/holdings").then((r) => r.json()),
    ])
      .then(([d, b, h]) => { setData(d); setBudget(b.items ?? []); setHoldings(Array.isArray(h) ? h : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  const portfolioCost = holdings.reduce((s, h) => s + h.quantity * h.avgCost, 0);

  return (
    <>
      <style>{`@media print { .no-print { display: none !important } body { background: white } }`}</style>

      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 no-print">
          <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 text-sm flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Dashboard
          </Link>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save PDF
          </button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500 text-white font-bold text-xl mb-3">M</div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">MoneyMind Monthly Report</h1>
          <p className="text-slate-500 mt-1">{monthLabel(month)}</p>
        </div>

        {loading ? (
          <div className="space-y-4">{Array.from({length:4}).map((_,i)=><div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse"/>)}</div>
        ) : (
          <>
            {/* Summary */}
            <section className="mb-8">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Summary</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Income",       value: fmt(data?.currentMonth.income    ?? 0), color: "text-emerald-600" },
                  { label: "Expenses",     value: fmt(data?.currentMonth.expenses  ?? 0), color: "text-red-500" },
                  { label: "Net Savings",  value: fmt(data?.currentMonth.savings   ?? 0), color: "text-blue-600" },
                  { label: "Savings Rate", value: `${(data?.currentMonth.savingsRate ?? 0).toFixed(1)}%`, color: "text-indigo-600" },
                ].map((s) => (
                  <div key={s.label} className="border border-slate-200 rounded-xl px-4 py-3">
                    <p className="text-xs text-slate-400 mb-0.5">{s.label}</p>
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Top Categories */}
            {(data?.topCategories.length ?? 0) > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Top Expense Categories</h2>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {data!.topCategories.map((c, i) => (
                    <div key={c.name} className={`flex items-center justify-between px-4 py-3 ${i < data!.topCategories.length - 1 ? "border-b border-slate-100" : ""}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-xs font-medium text-slate-400 w-4">{i + 1}</span>
                        <span className="text-sm text-slate-700">{c.name}</span>
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full mx-2 hidden sm:block">
                          <div className="h-1.5 bg-red-400 rounded-full" style={{ width: `${c.percentage}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-semibold text-slate-700">{fmt(c.amount)}</span>
                        <span className="text-xs text-slate-400 ml-2">{c.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Budget */}
            {budget.filter((b) => b.limit !== null).length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Budget Overview</h2>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {budget.filter((b) => b.limit !== null).map((b, i, arr) => (
                    <div key={b.categoryName} className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                      <span className="text-sm text-slate-700">{b.categoryName}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400">{fmt(b.spent)} / {fmt(b.limit!)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.status === "over" ? "bg-red-100 text-red-600" : b.status === "warning" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                          {b.status === "over" ? "Over" : b.status === "warning" ? "Near limit" : "OK"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Portfolio */}
            {holdings.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Portfolio ({holdings.length} holdings)</h2>
                <div className="border border-slate-200 rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-sm text-slate-600">{holdings.length} asset{holdings.length !== 1 ? "s" : ""} at cost basis</span>
                  <span className="text-lg font-bold text-slate-800">{fmt(portfolioCost)}</span>
                </div>
              </section>
            )}

            {/* Recent Transactions */}
            {(data?.recentTransactions.length ?? 0) > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Recent Transactions</h2>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {data!.recentTransactions.map((t, i, arr) => (
                    <div key={t.id} className={`flex items-center justify-between px-4 py-2.5 ${i < arr.length - 1 ? "border-b border-slate-100" : ""}`}>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 truncate">{t.description}</p>
                        <p className="text-xs text-slate-400">{t.category} · {new Date(t.occurredAt).toLocaleDateString("en-IE")}</p>
                      </div>
                      <span className={`text-sm font-semibold shrink-0 ml-4 ${t.direction === "INCOME" ? "text-emerald-600" : "text-red-500"}`}>
                        {t.direction === "INCOME" ? "+" : "-"}{fmt(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <p className="text-center text-xs text-slate-300 mt-10">Generated by MoneyMind · {new Date().toLocaleDateString("en-IE")}</p>
          </>
        )}
      </div>
    </>
  );
}
