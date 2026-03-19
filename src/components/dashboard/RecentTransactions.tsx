interface Transaction {
  id: string;
  description: string;
  amount: number;
  direction: "INCOME" | "EXPENSE";
  category: string;
  occurredAt: string;
}

interface Props {
  transactions: Transaction[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default function RecentTransactions({ transactions }: Props) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Recent Transactions
        </h2>
        <span className="text-xs text-slate-400">Last 8</span>
      </div>

      {transactions.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">No transactions yet</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left border-b border-slate-100 dark:border-slate-800">
              <th className="pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-4">Date</th>
              <th className="pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-4">Description</th>
              <th className="pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider pr-4">Category</th>
              <th className="pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="py-2.5 pr-4 text-slate-400 text-xs whitespace-nowrap">
                  {formatDate(tx.occurredAt)}
                </td>
                <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300 font-medium truncate max-w-[180px]">
                  {tx.description}
                </td>
                <td className="py-2.5 pr-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {tx.category}
                  </span>
                </td>
                <td className={`py-2.5 text-right font-semibold tabular-nums ${
                  tx.direction === "INCOME"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-500 dark:text-red-400"
                }`}>
                  {tx.direction === "INCOME" ? "+" : "-"}€{tx.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
