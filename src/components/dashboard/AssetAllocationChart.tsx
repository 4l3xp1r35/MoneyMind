"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface AllocationItem {
  name: string;
  color: string;
  value: number;
}

interface Props {
  data: AllocationItem[];
  totalValue: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export default function AssetAllocationChart({ data, totalValue }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Asset Allocation</p>
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <ResponsiveContainer width={110} height={110}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={28} outerRadius={52} paddingAngle={3} dataKey="value">
                {data.map((a, i) => <Cell key={i} fill={a.color} />)}
              </Pie>
              <Tooltip
                formatter={(v) => [fmt(Number(v)), undefined]}
                contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.map((a) => {
            const pct = totalValue > 0 ? (a.value / totalValue) * 100 : 0;
            return (
              <div key={a.name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{a.name}</span>
                </div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
