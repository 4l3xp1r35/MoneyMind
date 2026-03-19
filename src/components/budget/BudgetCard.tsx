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

interface Props {
  item: BudgetItem;
  onEdit: (item: BudgetItem) => void;
  onDelete: (budgetId: string) => void;
}

const statusStyles = {
  ok:      { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
  warning: { bar: "bg-amber-400",   text: "text-amber-600 dark:text-amber-400",     badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  over:    { bar: "bg-red-500",     text: "text-red-600 dark:text-red-400",          badge: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" },
  unset:   { bar: "bg-slate-300 dark:bg-slate-600", text: "text-slate-500", badge: "bg-slate-100 dark:bg-slate-800 text-slate-500" },
};

const statusLabel = { ok: "On track", warning: "Approaching", over: "Over budget", unset: "No limit" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function BudgetCard({ item, onEdit, onDelete }: Props) {
  const s = statusStyles[item.status];
  const pct = Math.min(item.percentage ?? 0, 100);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">{item.categoryName}</p>
          <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium ${s.badge}`}>
            {statusLabel[item.status]}
          </span>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={item.budgetId ? "Edit budget" : "Set budget"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
          {item.budgetId && (
            <button
              onClick={() => onDelete(item.budgetId!)}
              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              title="Remove budget"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
          style={{ width: `${item.limit ? pct : 0}%` }}
        />
      </div>

      {/* Numbers */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">
          Spent <span className={`font-semibold ${s.text}`}>{fmt(item.spent)}</span>
        </span>
        {item.limit !== null ? (
          <span className="text-slate-500">
            of <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(item.limit)}</span>
            {item.remaining !== null && item.remaining >= 0 && (
              <span className="text-slate-400"> · {fmt(item.remaining)} left</span>
            )}
            {item.remaining !== null && item.remaining < 0 && (
              <span className="text-red-500 font-medium"> · {fmt(Math.abs(item.remaining))} over</span>
            )}
          </span>
        ) : (
          <button
            onClick={() => onEdit(item)}
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Set limit →
          </button>
        )}
      </div>

      {/* Percentage */}
      {item.percentage !== null && (
        <p className={`text-xs font-semibold mt-1 text-right ${s.text}`}>
          {item.percentage.toFixed(0)}%
        </p>
      )}
    </div>
  );
}
