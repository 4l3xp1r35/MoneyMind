"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}

interface Props {
  data: CategoryData[];
}

const COLORS = ["#f43f5e", "#f97316", "#facc15", "#a78bfa", "#38bdf8", "#34d399"];

export default function TopCategoriesChart({ data }: Props) {
  const isEmpty = data.length === 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
        Top Spending Categories
      </h2>
      {isEmpty ? (
        <div className="h-52 flex items-center justify-center text-sm text-slate-400">
          No expense data yet
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="amount"
              >
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`€${Number(value).toFixed(2)}`, undefined]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  fontSize: "12px",
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          <ul className="mt-2 space-y-1.5">
            {data.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[110px]">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  <span>€{item.amount.toFixed(0)}</span>
                  <span className="text-slate-400">{item.percentage}%</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
