"use client";

interface Category {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
}

export interface Filters {
  search: string;
  direction: "" | "INCOME" | "EXPENSE";
  categoryId: string;
  month: string;
}

interface Props {
  filters: Filters;
  categories: Category[];
  onChange: (f: Filters) => void;
  onReset: () => void;
}

export function defaultFilters(): Filters {
  const now = new Date();
  return {
    search: "",
    direction: "",
    categoryId: "",
    month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  };
}

export default function TransactionFilters({ filters, categories, onChange, onReset }: Props) {
  function set(key: keyof Filters, value: string) {
    onChange({ ...filters, [key]: value });
  }

  const visibleCategories =
    filters.direction
      ? categories.filter((c) => c.direction === filters.direction)
      : categories;

  const hasActiveFilters =
    filters.search || filters.direction || filters.categoryId;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px]">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search description…"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
        />
      </div>

      {/* Direction pills */}
      <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
        {([["", "All"], ["INCOME", "Income"], ["EXPENSE", "Expenses"]] as const).map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => {
              set("direction", val);
              // reset category when direction changes
              onChange({ ...filters, direction: val, categoryId: "" });
            }}
            className={`px-3 py-2 font-medium transition-colors ${
              filters.direction === val
                ? val === "INCOME"
                  ? "bg-emerald-500 text-white"
                  : val === "EXPENSE"
                  ? "bg-red-500 text-white"
                  : "bg-slate-700 text-white"
                : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category */}
      <select
        value={filters.categoryId}
        onChange={(e) => set("categoryId", e.target.value)}
        className="py-2 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
      >
        <option value="">All categories</option>
        {visibleCategories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* Month */}
      <input
        type="month"
        value={filters.month}
        onChange={(e) => set("month", e.target.value)}
        className="py-2 px-3 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
      />

      {/* Reset */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline underline-offset-2 transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
