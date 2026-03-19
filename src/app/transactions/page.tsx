"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TransactionModal, { TransactionFormData } from "@/components/transactions/TransactionModal";
import TransactionFilters, {
  defaultFilters,
  Filters,
} from "@/components/transactions/TransactionFilters";
import TransactionList, { Transaction } from "@/components/transactions/TransactionList";

interface Category {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
}

interface ApiResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  totalPages: number;
  summary: { income: number; expenses: number };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(n);
}

export default function TransactionsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<TransactionFormData | null>(null);

  // Fetch categories + trigger recurring processor once on mount
  useEffect(() => {
    fetch("/api/category").then((r) => r.json()).then(setCategories).catch(() => {});
    fetch("/api/transactions/process-recurring", { method: "POST" }).catch(() => {});
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filters.search) params.set("search", filters.search);
    if (filters.direction) params.set("direction", filters.direction);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.month) params.set("month", filters.month);

    try {
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Re-fetch when filters or page change (debounce search)
  useEffect(() => {
    const id = setTimeout(fetchTransactions, filters.search ? 300 : 0);
    return () => clearTimeout(id);
  }, [fetchTransactions, filters.search]);

  function handleFiltersChange(f: Filters) {
    setFilters(f);
    setPage(1);
  }

  function openAdd() {
    setEditForm(null);
    setModalOpen(true);
  }

  function openEdit(form: TransactionFormData) {
    setEditForm(form);
    setModalOpen(true);
  }

  const savings = (data?.summary.income ?? 0) - (data?.summary.expenses ?? 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data ? `${data.total} record${data.total !== 1 ? "s" : ""}` : "Loading…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/transactions/import"
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Import
          </Link>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Transaction
          </button>
        </div>
      </div>

      {/* Summary strip */}
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 px-4 py-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wide mb-0.5">Income</p>
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(data.summary.income)}</p>
          </div>
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-4 py-3">
            <p className="text-xs text-red-600 dark:text-red-400 font-medium uppercase tracking-wide mb-0.5">Expenses</p>
            <p className="text-lg font-bold text-red-600 dark:text-red-300">{fmt(data.summary.expenses)}</p>
          </div>
          <div className={`rounded-xl px-4 py-3 border ${savings >= 0 ? "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-900/40" : "bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/40"}`}>
            <p className={`text-xs font-medium uppercase tracking-wide mb-0.5 ${savings >= 0 ? "text-blue-700 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
              Net
            </p>
            <p className={`text-lg font-bold ${savings >= 0 ? "text-blue-700 dark:text-blue-300" : "text-orange-600 dark:text-orange-300"}`}>
              {fmt(savings)}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-4">
        <TransactionFilters
          filters={filters}
          categories={categories}
          onChange={handleFiltersChange}
          onReset={() => { setFilters(defaultFilters()); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <TransactionList
          transactions={data?.transactions ?? []}
          loading={loading}
          onEdit={openEdit}
          onDeleted={fetchTransactions}
        />

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
            <span className="text-slate-400 text-xs">
              Page {data.page} of {data.totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <TransactionModal
        open={modalOpen}
        initial={editForm}
        onClose={() => setModalOpen(false)}
        onSaved={fetchTransactions}
      />
    </div>
  );
}
