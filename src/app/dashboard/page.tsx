"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/dashboard/StatCard";
import IncomeExpenseChart from "@/components/dashboard/IncomeExpenseChart";
import PortfolioChart from "@/components/dashboard/PortfolioChart";
import NetWorthChart from "@/components/dashboard/NetWorthChart";
import TopCategoriesChart from "@/components/dashboard/TopCategoriesChart";
import AssetAllocationChart from "@/components/dashboard/AssetAllocationChart";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import { useLivePrices } from "@/hooks/useLivePrices";

const CLASS_META: Record<string, { label: string; color: string }> = {
  CRYPTO:    { label: "Crypto",    color: "#f7a600" },
  STOCK:     { label: "Stock",     color: "#6366f1" },
  ETF:       { label: "ETF",       color: "#00b897" },
  BOND:      { label: "Bond",      color: "#3b82f6" },
  COMMODITY: { label: "Commodity", color: "#f43f5e" },
  CASH:      { label: "Cash",      color: "#10b981" },
  OTHER:     { label: "Other",     color: "#94a3b8" },
};

interface DashboardData {
  currentMonth: { income: number; expenses: number; savings: number; savingsRate: number };
  monthlyChart: { month: string; income: number; expenses: number; savings: number }[];
  portfolioChart: { month: string; invested: number }[];
  netWorthChart: { month: string; netWorth: number }[];
  topCategories: { name: string; amount: number; percentage: number }[];
  insights: { category: string; current: number; previous: number; delta: number }[];
  recentTransactions: {
    id: string; description: string; amount: number;
    direction: "INCOME" | "EXPENSE"; category: string; occurredAt: string;
  }[];
}

interface Holding {
  id: string; symbol: string; assetClass: string;
  platform: string; priceSymbol: string | null;
  quantity: number; avgCost: number; leverage: number | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}
function currentMonthLabel() {
  return new Date().toLocaleString("default", { month: "long", year: "numeric" });
}
function currentMonthParam() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function DashboardPage() {
  const [data,     setData]     = useState<DashboardData | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading,  setLoading]  = useState(true);

  const prices = useLivePrices(holdings);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/holdings").then((r) => r.json()),
    ])
      .then(([dash, hs]) => { setData(dash); setHoldings(Array.isArray(hs) ? hs : []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Live portfolio value
  const portfolioValue = useMemo(() => {
    if (holdings.length === 0) return null;
    return holdings.reduce((sum, h) => {
      const key   = (h.priceSymbol || h.symbol).toUpperCase();
      const px    = prices[key];
      const price = px?.price ?? null;
      const lev   = h.leverage ?? 1;
      if (price == null) return sum + h.quantity * h.avgCost;
      if (h.leverage != null) {
        return sum + (h.quantity * h.avgCost) + (price - h.avgCost) * h.quantity * lev;
      }
      return sum + price * h.quantity;
    }, 0);
  }, [holdings, prices]);

  const hasPrices = Object.keys(prices).length > 0;

  // Asset allocation from live prices
  const { allocationData, totalValue } = useMemo(() => {
    const byClass: Record<string, number> = {};
    for (const h of holdings) {
      const key   = (h.priceSymbol || h.symbol).toUpperCase();
      const price = prices[key]?.price ?? h.avgCost;
      const val   = price * h.quantity * Math.abs(h.leverage ?? 1);
      byClass[h.assetClass] = (byClass[h.assetClass] ?? 0) + val;
    }
    const total = Object.values(byClass).reduce((s, v) => s + v, 0);
    const items = Object.entries(byClass).map(([cls, value]) => ({
      name:  CLASS_META[cls]?.label ?? cls,
      color: CLASS_META[cls]?.color ?? "#94a3b8",
      value,
    }));
    return { allocationData: items, totalValue: total };
  }, [holdings, prices]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{currentMonthLabel()}</p>
        </div>
        <Link
          href={`/reports/${currentMonthParam()}`}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          Monthly Report
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl p-5 bg-slate-100 dark:bg-slate-800 animate-pulse h-28" />
          ))
        ) : (
          <>
            <StatCard title="Income"       value={fmt(data?.currentMonth.income    ?? 0)} accent="green"  subtitle="This month" />
            <StatCard title="Expenses"     value={fmt(data?.currentMonth.expenses  ?? 0)} accent="red"    subtitle="This month" />
            <StatCard
              title="Net Savings" value={fmt(data?.currentMonth.savings ?? 0)} accent="blue"
              trend={(data?.currentMonth.savings ?? 0) > 0 ? "up" : (data?.currentMonth.savings ?? 0) < 0 ? "down" : "neutral"}
              trendLabel="This month"
            />
            <StatCard title="Savings Rate" value={`${(data?.currentMonth.savingsRate ?? 0).toFixed(1)}%`} accent="purple" subtitle="Of total income" />
          </>
        )}
      </div>

      {/* Spending Insights */}
      {!loading && (data?.insights?.length ?? 0) > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Spending Insights</p>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {data!.insights.map((ins) => (
              <div
                key={ins.category}
                className={`shrink-0 rounded-xl border px-4 py-3 min-w-[180px] ${
                  ins.delta > 0
                    ? "bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/40"
                    : "bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/40"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-sm font-bold ${ins.delta > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {ins.delta > 0 ? "+" : ""}{ins.delta}%
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={ins.delta > 0 ? "text-amber-500 rotate-0" : "text-emerald-500 rotate-180"}>
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{ins.category}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{fmt(ins.previous)} → {fmt(ins.current)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Value Banner */}
      {!loading && holdings.length > 0 && (
        <div className="mb-6 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 dark:from-slate-800 dark:to-slate-900 text-white px-6 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Portfolio Value</p>
            {portfolioValue != null ? (
              <p className="text-2xl font-bold">{fmt(portfolioValue)}</p>
            ) : (
              <div className="h-8 w-36 bg-slate-700 rounded animate-pulse mt-1" />
            )}
            <div className="flex items-center gap-1.5 mt-1">
              {hasPrices ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><p className="text-xs text-slate-400">Live prices</p></>
              ) : (
                <p className="text-xs text-slate-500">Loading prices…</p>
              )}
            </div>
          </div>
          {allocationData.length > 0 && (
            <div className="hidden md:block">
              <AssetAllocationChart data={allocationData} totalValue={totalValue} />
            </div>
          )}
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2">
          {loading ? <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-64 animate-pulse" /> : <IncomeExpenseChart data={data?.monthlyChart ?? []} />}
        </div>
        <div>
          {loading ? <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-64 animate-pulse" /> : <TopCategoriesChart data={data?.topCategories ?? []} />}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div>
          {loading ? <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-56 animate-pulse" /> : <PortfolioChart data={data?.portfolioChart ?? []} />}
        </div>
        <div>
          {loading ? <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-56 animate-pulse" /> : <NetWorthChart data={data?.netWorthChart ?? []} />}
        </div>
      </div>

      {/* Recent Transactions */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 h-48 animate-pulse" />
      ) : (
        <RecentTransactions transactions={data?.recentTransactions ?? []} />
      )}
    </div>
  );
}
