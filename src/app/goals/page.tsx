"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Goal {
  id: string;
  name: string;
  emoji: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  color: string;
}

const PRESET_COLORS = ["#6366f1","#10b981","#f59e0b","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6"];

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function daysLeft(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function GoalModal({ initial, onClose, onSaved }: { initial: Goal | null; onClose: () => void; onSaved: () => void }) {
  const [name,    setName]    = useState(initial?.name          ?? "");
  const [emoji,   setEmoji]   = useState(initial?.emoji         ?? "🎯");
  const [target,  setTarget]  = useState(initial?.targetAmount?.toString() ?? "");
  const [saved,   setSaved]   = useState(initial?.savedAmount?.toString()  ?? "");
  const [deadline,setDeadline]= useState(initial?.deadline ? initial.deadline.slice(0,10) : "");
  const [color,   setColor]   = useState(initial?.color         ?? "#6366f1");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !target) return setError("Name and target amount are required.");
    setSaving(true);
    setError("");
    try {
      const url    = initial ? `/api/goals/${initial.id}` : "/api/goals";
      const method = initial ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), emoji, targetAmount: parseFloat(target), savedAmount: parseFloat(saved || "0"), deadline: deadline || null, color }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Failed"); }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally { setSaving(false); }
  }

  return (
    <div ref={ref} onClick={(e) => e.target === ref.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">{initial ? "Edit Goal" : "New Goal"}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[64px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Emoji</label>
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2}
                className="w-full px-2 py-2 text-xl text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Goal Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Buy a car, Emergency fund…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Target Amount (€) *</label>
              <input type="number" step="any" min="0" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Saved So Far (€)</label>
              <input type="number" step="any" min="0" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Deadline (optional)</label>
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? "scale-125 ring-2 ring-offset-2 ring-slate-400" : ""}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">
              {saving ? "Saving…" : initial ? "Save Changes" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────
function GoalCard({ goal, onEdit, onDelete }: { goal: Goal; onEdit: (g: Goal) => void; onDelete: (id: string) => void }) {
  const pct      = goal.targetAmount > 0 ? Math.min((goal.savedAmount / goal.targetAmount) * 100, 100) : 0;
  const done     = pct >= 100;
  const days     = goal.deadline ? daysLeft(goal.deadline) : null;
  const overdue  = days !== null && days < 0;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{goal.emoji}</span>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{goal.name}</p>
            {done ? (
              <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full">Completed!</span>
            ) : days !== null ? (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${overdue ? "text-red-500 bg-red-50 dark:bg-red-950/30" : "text-slate-500 bg-slate-100 dark:bg-slate-800"}`}>
                {overdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(goal)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">{fmt(goal.savedAmount)} saved</span>
        <span className="text-xs font-semibold" style={{ color: goal.color }}>{pct.toFixed(0)}%</span>
        <span className="text-xs text-slate-400">of {fmt(goal.targetAmount)}</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const [goals,   setGoals]   = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/goals");
    if (res.ok) setGoals(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    load();
  }

  const totalSaved  = goals.reduce((s, g) => s + g.savedAmount,  0);
  const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
  const doneCount   = goals.filter((g) => g.savedAmount >= g.targetAmount).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {(modal || editing) && (
        <GoalModal
          initial={editing}
          onClose={() => { setModal(false); setEditing(null); }}
          onSaved={() => { setModal(false); setEditing(null); load(); }}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Financial Goals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track your savings targets</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Goal
        </button>
      </div>

      {/* Summary */}
      {!loading && goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total Saved",   value: fmt(totalSaved),  color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Total Target",  value: fmt(totalTarget), color: "text-slate-700 dark:text-slate-200" },
            { label: "Goals Reached", value: `${doneCount} / ${goals.length}`, color: "text-indigo-600 dark:text-indigo-400" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-0.5">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="py-24 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No goals yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">Set a savings target and track your progress</p>
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors">
            Create your first goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={(g) => setEditing(g)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
