"use client";

export const dynamic = "force-dynamic";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

interface ConnectedPlatform {
  id: string;
  name: string;
  label: string;
  isEnabled: boolean;
  extra: Record<string, string> | null;
}

const PLATFORM_OPTIONS = [
  { value: "bybit",      label: "Bybit",           needsSecret: true,  extraMode: false },
  { value: "mexc",       label: "MEXC",             needsSecret: true,  extraMode: false },
  { value: "trading212", label: "Trading 212",      needsSecret: false, extraMode: true  },
];

const PLATFORM_META: Record<string, { color: string; icon: string }> = {
  bybit:       { color: "#f7a600", icon: "B" },
  mexc:        { color: "#00b897", icon: "M" },
  trading212:  { color: "#1de9b6", icon: "T" },
};

interface Category {
  id: string;
  name: string;
  direction: "INCOME" | "EXPENSE";
}

interface TxType {
  id: string;
  name: string;
  appliesTo: "INCOME" | "EXPENSE" | "BOTH";
}

// ─── Inline row editor ───────────────────────────────────────────────────────
function EditableRow({
  label,
  badge,
  badgeColor,
  onSave,
  onDelete,
  deleteError,
}: {
  label: string;
  badge: string;
  badgeColor: string;
  onSave: (name: string) => Promise<string | null>;
  onDelete: () => Promise<void>;
  deleteError?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save() {
    if (!value.trim() || value.trim() === label) { setEditing(false); return; }
    setSaving(true);
    const err = await onSave(value.trim());
    if (err) { setError(err); setSaving(false); }
    else { setEditing(false); setSaving(false); setError(""); }
  }

  async function del() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirmDelete(false);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badgeColor}`}>{badge}</span>

      {editing ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setValue(label); } }}
          className="flex-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
        />
      ) : (
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{label}</span>
      )}

      {error && <span className="text-xs text-red-500">{error}</span>}

      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <button onClick={save} disabled={saving} className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors">
              {saving ? "…" : "Save"}
            </button>
            <button onClick={() => { setEditing(false); setValue(label); setError(""); }} className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button onClick={() => setEditing(true)} className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Rename">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-slate-500">Delete?</span>
                <button onClick={del} disabled={deleting} className="px-2 py-1 text-xs rounded-md bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors">
                  {deleting ? "…" : "Yes"}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 text-xs rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 transition-colors">
                  No
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors" title="Delete">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            )}
          </>
        )}
      </div>
      {deleteError && <span className="text-xs text-red-400 ml-1">{deleteError}</span>}
    </div>
  );
}

// ─── Add row form ─────────────────────────────────────────────────────────────
function AddRow({ onAdd, placeholder }: { onAdd: (name: string) => Promise<string | null>; placeholder: string }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setSaving(true);
    const err = await onAdd(value.trim());
    if (err) { setError(err); setSaving(false); }
    else { setValue(""); setError(""); setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 mt-2">
      <input
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(""); }}
        placeholder={placeholder}
        className="flex-1 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
      />
      <button type="submit" disabled={saving || !value.trim()} className="px-3 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-50 transition-colors">
        {saving ? "…" : "Add"}
      </button>
      {error && <span className="text-xs text-red-500 self-center">{error}</span>}
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function SettingsContent() {
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TxType[]>([]);
  const [platforms, setPlatforms] = useState<ConnectedPlatform[]>([]);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const initialTab = searchParams.get("tab") === "platforms" ? "platforms" : "categories";
  const [tab, setTab] = useState<"categories" | "types" | "platforms">(initialTab);
  const [newTypeAppliesTo, setNewTypeAppliesTo] = useState<"INCOME" | "EXPENSE" | "BOTH">("BOTH");

  // Connect platform modal state
  const [showConnect, setShowConnect] = useState(false);
  const [connectForm, setConnectForm] = useState({ name: "bybit", label: "", apiKey: "", apiSecret: "", mode: "live" });
  const [connectSaving, setConnectSaving] = useState(false);
  const [connectError, setConnectError] = useState("");
  const apiKeyRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [catRes, typeRes, platRes] = await Promise.all([
      fetch("/api/category"),
      fetch("/api/type"),
      fetch("/api/platforms"),
    ]);
    if (catRes.ok) setCategories(await catRes.json());
    if (typeRes.ok) setTypes(await typeRes.json());
    if (platRes.ok) setPlatforms(await platRes.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setConnectSaving(true);
    setConnectError("");
    const selected = PLATFORM_OPTIONS.find(p => p.value === connectForm.name)!;
    const body: Record<string, unknown> = {
      name: connectForm.name,
      label: connectForm.label || selected.label,
      apiKey: connectForm.apiKey,
    };
    if (selected.needsSecret) body.apiSecret = connectForm.apiSecret;
    if (selected.extraMode) body.extra = { mode: connectForm.mode };

    const res = await fetch("/api/platforms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setConnectError((await res.json()).error ?? "Failed to connect");
      setConnectSaving(false);
      return;
    }
    setShowConnect(false);
    setConnectForm({ name: "bybit", label: "", apiKey: "", apiSecret: "", mode: "live" });
    setConnectSaving(false);
    await load();
  }

  async function disconnectPlatform(id: string) {
    await fetch(`/api/platforms/${id}`, { method: "DELETE" });
    await load();
  }

  // Categories
  async function addCategory(name: string, direction: "INCOME" | "EXPENSE"): Promise<string | null> {
    const res = await fetch("/api/category", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, direction }) });
    if (!res.ok) return (await res.json()).error ?? "Failed";
    await load(); return null;
  }

  async function renameCategory(id: string, name: string): Promise<string | null> {
    const res = await fetch("/api/category", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
    if (!res.ok) return (await res.json()).error ?? "Failed";
    await load(); return null;
  }

  async function deleteCategory(id: string) {
    const res = await fetch(`/api/category?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const msg = (await res.json()).error ?? "Failed to delete";
      setDeleteErrors((p) => ({ ...p, [id]: msg }));
      setTimeout(() => setDeleteErrors((p) => { const n = { ...p }; delete n[id]; return n; }), 3000);
    } else { await load(); }
  }

  // Types
  async function addType(name: string): Promise<string | null> {
    const res = await fetch("/api/type", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, appliesTo: newTypeAppliesTo }) });
    if (!res.ok) return (await res.json()).error ?? "Failed";
    await load(); return null;
  }

  async function renameType(id: string, name: string): Promise<string | null> {
    const res = await fetch("/api/type", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name }) });
    if (!res.ok) return (await res.json()).error ?? "Failed";
    await load(); return null;
  }

  async function deleteType(id: string) {
    await fetch(`/api/type?id=${id}`, { method: "DELETE" });
    await load();
  }

  const incomeCategories = categories.filter((c) => c.direction === "INCOME");
  const expenseCategories = categories.filter((c) => c.direction === "EXPENSE");

  const directionBadge = (d: "INCOME" | "EXPENSE") =>
    d === "INCOME"
      ? { badge: "Income", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" }
      : { badge: "Expense", color: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" };

  const appliesToBadge = (a: "INCOME" | "EXPENSE" | "BOTH") => {
    if (a === "INCOME") return { badge: "Income", color: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" };
    if (a === "EXPENSE") return { badge: "Expense", color: "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" };
    return { badge: "Both", color: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400" };
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your categories and transaction types</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 mb-6 w-fit">
        {(["categories", "types", "platforms"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${tab === t ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "categories" && (
        <div className="space-y-5">
          {/* Expense categories */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Expense Categories
              <span className="text-xs font-normal text-slate-400 ml-auto">{expenseCategories.length} categories</span>
            </h2>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {expenseCategories.length === 0 && <p className="text-sm text-slate-400 py-3">No expense categories yet.</p>}
              {expenseCategories.map((c) => {
                const { badge, color } = directionBadge(c.direction);
                return (
                  <EditableRow key={c.id} label={c.name} badge={badge} badgeColor={color}
                    onSave={(name) => renameCategory(c.id, name)}
                    onDelete={() => deleteCategory(c.id)}
                    deleteError={deleteErrors[c.id]}
                  />
                );
              })}
            </div>
            <AddRow onAdd={(name) => addCategory(name, "EXPENSE")} placeholder="New expense category…" />
          </div>

          {/* Income categories */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Income Categories
              <span className="text-xs font-normal text-slate-400 ml-auto">{incomeCategories.length} categories</span>
            </h2>
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {incomeCategories.length === 0 && <p className="text-sm text-slate-400 py-3">No income categories yet.</p>}
              {incomeCategories.map((c) => {
                const { badge, color } = directionBadge(c.direction);
                return (
                  <EditableRow key={c.id} label={c.name} badge={badge} badgeColor={color}
                    onSave={(name) => renameCategory(c.id, name)}
                    onDelete={() => deleteCategory(c.id)}
                    deleteError={deleteErrors[c.id]}
                  />
                );
              })}
            </div>
            <AddRow onAdd={(name) => addCategory(name, "INCOME")} placeholder="New income category…" />
          </div>
        </div>
      )}

      {tab === "types" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Transaction Types</h2>
          <p className="text-xs text-slate-400 mb-4">Optional labels like "Fixed", "Variable", "One-off"</p>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {types.length === 0 && <p className="text-sm text-slate-400 py-3">No types yet.</p>}
            {types.map((t) => {
              const { badge, color } = appliesToBadge(t.appliesTo);
              return (
                <EditableRow key={t.id} label={t.name} badge={badge} badgeColor={color}
                  onSave={(name) => renameType(t.id, name)}
                  onDelete={() => deleteType(t.id)}
                />
              );
            })}
          </div>
          {/* Add type with appliesTo selector */}
          <div className="mt-3 space-y-2">
            <div className="flex gap-1">
              {(["BOTH", "INCOME", "EXPENSE"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setNewTypeAppliesTo(a)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg border transition-colors ${newTypeAppliesTo === a ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                  {a === "BOTH" ? "Both" : a === "INCOME" ? "Income" : "Expense"}
                </button>
              ))}
            </div>
            <AddRow onAdd={addType} placeholder="New type name…" />
          </div>
        </div>
      )}

      {tab === "platforms" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">API keys are encrypted before being stored.</p>
            <button
              onClick={() => { setShowConnect(true); setConnectError(""); setTimeout(() => apiKeyRef.current?.focus(), 80); }}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Connect Platform
            </button>
          </div>

          {platforms.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
              <p className="text-2xl mb-2">🔌</p>
              <p className="text-sm text-slate-500">No platforms connected yet</p>
              <p className="text-xs text-slate-400 mt-1">Connect Bybit, MEXC or Trading 212 to track your portfolio</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
              {platforms.map((p) => {
                const meta = PLATFORM_META[p.name] ?? { color: "#6366f1", icon: "?" };
                return (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: meta.color }}>
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.label}</p>
                      <p className="text-xs text-slate-400 capitalize">{p.name}{p.extra?.mode ? ` · ${p.extra.mode}` : ""}</p>
                    </div>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">Connected</span>
                    <button
                      onClick={() => disconnectPlatform(p.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors ml-1"
                      title="Disconnect"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Connect Platform Modal */}
      {showConnect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowConnect(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Connect Platform</h2>
              <button onClick={() => setShowConnect(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleConnect} className="px-6 py-5 space-y-4">
              {/* Platform picker */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Platform</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORM_OPTIONS.map((opt) => {
                    const m = PLATFORM_META[opt.value];
                    return (
                      <button key={opt.value} type="button"
                        onClick={() => setConnectForm(f => ({ ...f, name: opt.value }))}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${connectForm.name === opt.value ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20" : "border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: m.color }}>{m.icon}</div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Label <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="text" placeholder={`e.g. ${PLATFORM_OPTIONS.find(p => p.value === connectForm.name)?.label} Main`}
                  value={connectForm.label} onChange={(e) => setConnectForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {connectForm.name === "trading212" ? "API Key" : "API Key"}
                </label>
                <input ref={apiKeyRef} type="password" placeholder="Paste your API key…"
                  value={connectForm.apiKey} onChange={(e) => setConnectForm(f => ({ ...f, apiKey: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                  required
                />
              </div>

              {/* API Secret (not for T212) */}
              {PLATFORM_OPTIONS.find(p => p.value === connectForm.name)?.needsSecret && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">API Secret</label>
                  <input type="password" placeholder="Paste your API secret…"
                    value={connectForm.apiSecret} onChange={(e) => setConnectForm(f => ({ ...f, apiSecret: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    required
                  />
                </div>
              )}

              {/* T212 mode */}
              {PLATFORM_OPTIONS.find(p => p.value === connectForm.name)?.extraMode && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Account type</label>
                  <div className="flex gap-2">
                    {(["live", "demo"] as const).map((m) => (
                      <button key={m} type="button" onClick={() => setConnectForm(f => ({ ...f, mode: m }))}
                        className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors capitalize ${connectForm.mode === m ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {connectError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{connectError}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowConnect(false)} className="flex-1 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
                <button type="submit" disabled={connectSaving} className="flex-1 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">
                  {connectSaving ? "Connecting…" : "Connect"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
