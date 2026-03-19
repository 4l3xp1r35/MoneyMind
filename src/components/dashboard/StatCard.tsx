interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  accent?: "green" | "red" | "blue" | "purple";
}

const accentStyles = {
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    icon: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400",
    value: "text-emerald-700 dark:text-emerald-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-950/30",
    icon: "bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400",
    value: "text-red-700 dark:text-red-300",
  },
  blue: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    icon: "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400",
    value: "text-blue-700 dark:text-blue-300",
  },
  purple: {
    bg: "bg-purple-50 dark:bg-purple-950/30",
    icon: "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400",
    value: "text-purple-700 dark:text-purple-300",
  },
};

const trendIcons = {
  up: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  ),
  down: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  neutral: null,
};

export default function StatCard({ title, value, subtitle, trend, trendLabel, accent = "blue" }: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <div className={`rounded-xl p-5 ${styles.bg} border border-white/60 dark:border-white/5 shadow-sm`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
        {title}
      </p>
      <p className={`text-2xl font-bold tracking-tight ${styles.value}`}>{value}</p>
      {(trendLabel || subtitle) && (
        <div className="mt-2 flex items-center gap-1.5">
          {trend && trend !== "neutral" && (
            <span className={`flex items-center ${trend === "up" ? "text-emerald-500" : "text-red-500"}`}>
              {trendIcons[trend]}
            </span>
          )}
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {trendLabel ?? subtitle}
          </span>
        </div>
      )}
    </div>
  );
}
