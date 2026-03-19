export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-base shadow-md">
            M
          </div>
          <span className="text-xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
            MoneyMind
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
