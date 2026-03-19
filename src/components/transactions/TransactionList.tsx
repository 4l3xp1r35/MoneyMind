"use client";

import { useState } from "react";
import { TransactionFormData } from "./TransactionModal";

export interface Transaction {
  id: string;
  description: string | null;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  occurredAt: string;
  category: { id: string; name: string };
  type: { id: string; name: string } | null;
}

interface Props {
  transactions: Transaction[];
  loading: boolean;
  onEdit: (form: TransactionFormData) => void;
  onDeleted: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function TransactionList({ transactions, loading, onEdit, onDeleted }: Props) {
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [bulkDel,    setBulkDel]    = useState(false);   // confirm bulk
  const [bulkBusy,   setBulkBusy]   = useState(false);

  const allIds    = transactions.map((t) => t.id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = !allChecked && allIds.some((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setConfirmId(null);
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
    setConfirmId(null);
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      onDeleted();
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }

  async function handleBulkDelete() {
    setBulkBusy(true);
    try {
      await fetch("/api/transactions/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      setSelected(new Set());
      setBulkDel(false);
      onDeleted();
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">💸</div>
        <p className="text-sm text-slate-500">No transactions found</p>
        <p className="text-xs text-slate-400 mt-1">Try changing the filters or add a new one</p>
      </div>
    );
  }

  return (
    <>
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 text-white text-sm">
          <span className="text-slate-300 text-xs font-medium">
            {selected.size} transaction{selected.size !== 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Deselect all
            </button>
            {bulkDel ? (
              <>
                <span className="text-xs text-slate-300">Delete {selected.size}?</span>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkBusy}
                  className="px-3 py-1 text-xs font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-50 transition-colors"
                >
                  {bulkBusy ? "Deleting…" : "Confirm"}
                </button>
                <button
                  onClick={() => setBulkDel(false)}
                  className="px-3 py-1 text-xs rounded-lg bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setBulkDel(true)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete selected
              </button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              {/* Select-all checkbox */}
              <th className="pb-3 pr-3 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                />
              </th>
              {["Date", "Description", "Category", "Type", "Amount", ""].map((h) => (
                <th
                  key={h}
                  className={`pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400 ${
                    h === "Amount" ? "text-right pr-2" : "text-left pr-4"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {transactions.map((tx) => {
              const isSelected = selected.has(tx.id);
              return (
                <tr
                  key={tx.id}
                  className={`transition-colors group ${
                    isSelected
                      ? "bg-emerald-50/50 dark:bg-emerald-950/10"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-3 pr-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(tx.id)}
                      className="rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                    />
                  </td>

                  <td className="py-3 pr-4 text-slate-400 text-xs whitespace-nowrap">
                    {formatDate(tx.occurredAt)}
                  </td>
                  <td className="py-3 pr-4 text-slate-700 dark:text-slate-300 font-medium max-w-[200px] truncate">
                    {tx.description ?? tx.category.name}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {tx.category.name}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-slate-400 text-xs">
                    {tx.type?.name ?? <span className="text-slate-300 dark:text-slate-600">—</span>}
                  </td>
                  <td className={`py-3 pr-2 text-right font-semibold tabular-nums whitespace-nowrap ${
                    tx.direction === "INCOME"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                  }`}>
                    {tx.direction === "INCOME" ? "+" : "-"}€{tx.amount.toFixed(2)}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Edit */}
                      <button
                        onClick={() =>
                          onEdit({
                            id: tx.id,
                            direction: tx.direction,
                            amount: tx.amount.toString(),
                            categoryId: tx.category.id,
                            typeId: tx.type?.id ?? "",
                            description: tx.description ?? "",
                            occurredAt: tx.occurredAt.slice(0, 10),
                            recurrence: "",
                          })
                        }
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        title="Edit"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>

                      {/* Single delete */}
                      {confirmId === tx.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">Sure?</span>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            disabled={deleting === tx.id}
                            className="px-2 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deleting === tx.id ? "…" : "Yes"}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(tx.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          title="Delete"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
