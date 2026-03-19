"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AssetOption { id: string; symbol: string; name: string; assetClass: string; }

interface Trade {
  id: string;
  assetId: string;
  symbol: string;
  assetName: string;
  assetClass: string;
  direction: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  platform: string;
  tradedAt: string;
  notes: string | null;
}

interface CostBasis {
  assetId: string;
  symbol: string;
  name: string;
  assetClass: string;
  method: "FIFO" | "LIFO" | "AVG";
  currentQty: number;
  avgCost: number;
  realizedPnL: number;
  totalFees: number;
  totalBought: number;
  totalSold: number;
}

// ── Shared constants from investments page ────────────────────────────────────
const PLATFORM_OPTIONS = [
  { value: "bybit",       label: "Bybit" },
  { value: "mexc",        label: "MEXC" },
  { value: "trading-212", label: "Trading 212" },
  { value: "ibkr",        label: "Interactive Brokers" },
  { value: "binance",     label: "Binance" },
  { value: "kraken",      label: "Kraken" },
  { value: "coinbase",    label: "Coinbase" },
  { value: "etoro",       label: "eToro" },
  { value: "revolut",     label: "Revolut" },
  { value: "degiro",      label: "DEGIRO" },
  { value: "other",       label: "Other / Manual" },
];

const CLASS_META: Record<string, { color: string }> = {
  CRYPTO:    { color: "#f7a600" },
  STOCK:     { color: "#6366f1" },
  ETF:       { color: "#00b897" },
  BOND:      { color: "#3b82f6" },
  COMMODITY: { color: "#f43f5e" },
  OTHER:     { color: "#94a3b8" },
};

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  bybit:         { label: "Bybit",       color: "#f7a600" },
  mexc:          { label: "MEXC",        color: "#00b897" },
  "trading-212": { label: "Trading 212", color: "#6366f1" },
  ibkr:          { label: "IBKR",        color: "#3b82f6" },
  binance:       { label: "Binance",     color: "#f0b90b" },
  kraken:        { label: "Kraken",      color: "#5741d9" },
  coinbase:      { label: "Coinbase",    color: "#0052ff" },
  etoro:         { label: "eToro",       color: "#00b297" },
  revolut:       { label: "Revolut",     color: "#191c1f" },
  degiro:        { label: "DEGIRO",      color: "#e8362d" },
  other:         { label: "Other",       color: "#94a3b8" },
};

function pmeta(key: string) {
  return PLATFORM_META[key] ?? { label: key, color: "#94a3b8" };
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtQty(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

// ── Trade Modal ───────────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Trade | null;
  assets: AssetOption[];
  onClose: () => void;
  onSaved: () => void;
}

function TradeModal({ initial, assets, onClose, onSaved }: ModalProps) {
  const [assetId,   setAssetId]   = useState(initial?.assetId   ?? assets[0]?.id ?? "");
  const [direction, setDirection] = useState<"BUY" | "SELL">(initial?.direction ?? "BUY");
  const [quantity,  setQuantity]  = useState(initial?.quantity?.toString() ?? "");
  const [price,     setPrice]     = useState(initial?.price?.toString()    ?? "");
  const [fees,      setFees]      = useState(initial?.fees?.toString()     ?? "0");
  const [platform,  setPlatform]  = useState(initial?.platform   ?? "other");
  const [tradedAt,  setTradedAt]  = useState(
    initial ? initial.tradedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [notes,  setNotes]  = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const qty  = parseFloat(quantity);
  const prc  = parseFloat(price);
  const fe   = parseFloat(fees) || 0;
  const total = qty > 0 && prc > 0
    ? direction === "BUY" ? qty * prc + fe : qty * prc - fe
    : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!assetId || !quantity || !price || !tradedAt)
      return setError("Asset, quantity, price and date are required.");

    setSaving(true);
    try {
      const url    = initial ? `/api/trades/${initial.id}` : "/api/trades";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, direction, quantity: qty, price: prc, fees: fe, platform, tradedAt, notes: notes || null }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error ?? "Failed to save");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">
          {initial ? "Edit Trade" : "Log Trade"}
        </h2>

        <form onSubmit={submit} className="space-y-4">
          {/* Asset */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Asset *</label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>
              ))}
            </select>
          </div>

          {/* Direction */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Direction *</label>
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {(["BUY", "SELL"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDirection(d)}
                  className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                    direction === d
                      ? d === "BUY"
                        ? "bg-emerald-500 text-white"
                        : "bg-red-500 text-white"
                      : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Date + Platform */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Trade Date *</label>
              <input
                type="date"
                value={tradedAt}
                onChange={(e) => setTradedAt(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Quantity *</label>
              <input
                type="number" step="any" min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.5"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Price per Unit (USD) *</label>
              <input
                type="number" step="any" min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="60000"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Fees + Notes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fees (USD)</label>
              <input
                type="number" step="any" min="0"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Total preview */}
          {total != null && (
            <p className="text-xs bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg text-slate-500">
              {direction === "BUY" ? "Total Cost" : "Net Proceeds"}:{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">{fmt(total)}</span>
              <span className="ml-1 opacity-60">({fmtQty(qty)} × {fmt(prc)}{fe > 0 ? ` ${direction === "BUY" ? "+" : "−"} ${fmt(fe)} fees` : ""})</span>
            </p>
          )}

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50">
              {saving ? "Saving…" : initial ? "Save Changes" : "Log Trade"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Cost Basis Panel ──────────────────────────────────────────────────────────
function CostBasisPanel({ items }: { items: CostBasis[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cost Basis Summary</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((cb) => {
          const meta = CLASS_META[cb.assetClass] ?? CLASS_META.OTHER;
          return (
            <div key={cb.assetId} className="shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-w-[180px]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: meta.color }}>
                  {cb.symbol.slice(0, 2)}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{cb.symbol}</p>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{cb.method}</span>
                </div>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Avg Cost</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">{fmt(cb.avgCost)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Realized P&L</span>
                  <span className={`font-semibold ${cb.realizedPnL >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                    {cb.realizedPnL >= 0 ? "+" : ""}{fmt(cb.realizedPnL)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Fees</span>
                  <span className="text-slate-500">{fmt(cb.totalFees)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Position</span>
                  <span className="text-slate-600 dark:text-slate-400">{fmtQty(cb.currentQty)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main TradesTab ────────────────────────────────────────────────────────────
export default function TradesTab() {
  const [trades,     setTrades]     = useState<Trade[]>([]);
  const [costBasis,  setCostBasis]  = useState<CostBasis[]>([]);
  const [assets,     setAssets]     = useState<AssetOption[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState<"add" | "edit" | null>(null);
  const [editing,    setEditing]    = useState<Trade | null>(null);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [filterAsset,     setFilterAsset]     = useState("");
  const [filterDirection, setFilterDirection] = useState("");
  const [filterPlatform,  setFilterPlatform]  = useState("");
  const [filterFrom,      setFilterFrom]      = useState("");
  const [filterTo,        setFilterTo]        = useState("");

  const fetchAll = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (filterAsset)     params.set("assetId",   filterAsset);
      if (filterDirection) params.set("direction", filterDirection);
      if (filterPlatform)  params.set("platform",  filterPlatform);
      if (filterFrom)      params.set("from",       filterFrom);
      if (filterTo)        params.set("to",         filterTo);

      const [tradesRes, cbRes, assetsRes] = await Promise.all([
        fetch(`/api/trades?${params}`),
        fetch("/api/trades/costbasis"),
        fetch("/api/holdings"),
      ]);

      if (tradesRes.ok) {
        const data = await tradesRes.json();
        setTrades(data.trades);
        setTotalPages(data.totalPages);
        setPage(data.page);
      }
      if (cbRes.ok)     setCostBasis(await cbRes.json());
      if (assetsRes.ok) {
        const hs = await assetsRes.json();
        // Deduplicate assets from holdings
        const seen = new Set<string>();
        const uniq: AssetOption[] = [];
        for (const h of hs) {
          const key = h.symbol + h.assetClass;
          if (!seen.has(key)) {
            seen.add(key);
            // We need assetId — fetch it from a separate source or derive from holdings
            uniq.push({ id: h.id, symbol: h.symbol, name: h.name, assetClass: h.assetClass });
          }
        }
        setAssets(uniq);
      }
    } finally {
      setLoading(false);
    }
  }, [filterAsset, filterDirection, filterPlatform, filterFrom, filterTo]);

  useEffect(() => { fetchAll(1); }, [fetchAll]);

  async function deleteTrade(id: string) {
    if (!confirm("Delete this trade?")) return;
    await fetch(`/api/trades/${id}`, { method: "DELETE" });
    fetchAll(page);
  }

  function resetFilters() {
    setFilterAsset(""); setFilterDirection(""); setFilterPlatform(""); setFilterFrom(""); setFilterTo("");
  }

  // We need assetId for the trade modal — but holdings GET returns holding.id not asset.id
  // Need to fetch assets separately to get actual assetId
  const [assetOptions, setAssetOptions] = useState<AssetOption[]>([]);
  useEffect(() => {
    fetch("/api/holdings").then(r => r.json()).then(data => {
      const seen = new Set<string>();
      const uniq: AssetOption[] = [];
      for (const h of data) {
        if (!seen.has(h.symbol)) {
          seen.add(h.symbol);
          uniq.push({ id: h.assetId ?? h.id, symbol: h.symbol, name: h.name, assetClass: h.assetClass });
        }
      }
      setAssetOptions(uniq);
    }).catch(() => {});
  }, []);

  if (loading && trades.length === 0) {
    return <div className="py-12 text-center text-sm text-slate-400">Loading trade history…</div>;
  }

  return (
    <>
      {(modal === "add" || modal === "edit") && assetOptions.length > 0 && (
        <TradeModal
          initial={modal === "edit" ? editing : null}
          assets={assetOptions}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchAll(page); }}
        />
      )}

      {/* Cost basis summary */}
      <CostBasisPanel items={costBasis} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filterAsset}
          onChange={(e) => setFilterAsset(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Assets</option>
          {assetOptions.map((a) => <option key={a.id} value={a.id}>{a.symbol}</option>)}
        </select>

        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
          {["", "BUY", "SELL"].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDirection(d)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                filterDirection === d
                  ? d === "BUY" ? "bg-emerald-500 text-white" : d === "SELL" ? "bg-red-500 text-white" : "bg-slate-700 text-white"
                  : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {d || "All"}
            </button>
          ))}
        </div>

        <select
          value={filterPlatform}
          onChange={(e) => setFilterPlatform(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">All Platforms</option>
          {PLATFORM_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500" />

        {(filterAsset || filterDirection || filterPlatform || filterFrom || filterTo) && (
          <button onClick={resetFilters} className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 underline">Reset</button>
        )}

        <button
          onClick={() => setModal("add")}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Log Trade
        </button>
      </div>

      {trades.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No trades logged yet</p>
          <p className="text-xs text-slate-400 mt-1">Log your buy and sell trades to track cost basis and P&L</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Asset</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Dir</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Fees</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Platform</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  {trades.map((t) => {
                    const cm = CLASS_META[t.assetClass] ?? CLASS_META.OTHER;
                    const pm = pmeta(t.platform);
                    const total = t.direction === "BUY"
                      ? t.quantity * t.price + t.fees
                      : t.quantity * t.price - t.fees;
                    return (
                      <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(t.tradedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: cm.color }}>
                              {t.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t.symbol}</p>
                              {t.notes && <p className="text-[10px] text-slate-400 truncate max-w-[120px]" title={t.notes}>{t.notes}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${t.direction === "BUY" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                            {t.direction}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">{fmtQty(t.quantity)}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">{fmt(t.price)}</td>
                        <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{fmt(total)}</td>
                        <td className="px-4 py-3 text-right text-xs text-slate-400 tabular-nums">{t.fees > 0 ? fmt(t.fees) : "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                            style={{ color: pm.color, borderColor: pm.color + "66", backgroundColor: pm.color + "18" }}>
                            {pm.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => { setEditing(t); setModal("edit"); }} className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => deleteTrade(t.id)} className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
              <button onClick={() => fetchAll(page - 1)} disabled={page <= 1} className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">← Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => fetchAll(page + 1)} disabled={page >= totalPages} className="px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Next →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
