"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Props {
  data: { month: string; netWorth: number }[];
}

function formatCurrency(value: number) {
  if (Math.abs(value) >= 1000) return `€${(value / 1000).toFixed(1)}k`;
  return `€${value.toFixed(0)}`;
}

export default function NetWorthChart({ data }: Props) {
  const isEmpty = data.every((d) => d.netWorth === 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Net Worth Timeline</h2>
      <p className="text-xs text-slate-400 mb-4">Cumulative savings + portfolio cost basis</p>
      {isEmpty ? (
        <div className="h-48 flex items-center justify-center text-sm text-slate-400">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={46} />
            <Tooltip
              formatter={(v) => [`€${Number(v).toFixed(2)}`, "Net Worth"]}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
            />
            <Area type="monotone" dataKey="netWorth" stroke="#10b981" strokeWidth={2.5} fill="url(#nwGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
