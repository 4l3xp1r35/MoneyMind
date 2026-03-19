"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import TradesTab from "@/components/investments/TradesTab";
import { useLivePrices } from "@/hooks/useLivePrices";

type AssetClass = "CRYPTO" | "STOCK" | "ETF" | "BOND" | "COMMODITY" | "CASH" | "OTHER";

interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  quantity: number;
  avgCost: number;
  platform: string;
  priceSymbol: string | null;
  leverage: number | null;
}

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  bybit:         { label: "Bybit",            color: "#f7a600" },
  mexc:          { label: "MEXC",             color: "#00b897" },
  "trading-212": { label: "Trading 212",      color: "#6366f1" },
  t212:          { label: "Trading 212",      color: "#6366f1" },
  ibkr:          { label: "IBKR",             color: "#3b82f6" },
  binance:       { label: "Binance",          color: "#f0b90b" },
  kraken:        { label: "Kraken",           color: "#5741d9" },
  coinbase:      { label: "Coinbase",         color: "#0052ff" },
  etoro:         { label: "eToro",            color: "#00b297" },
  revolut:       { label: "Revolut",          color: "#191c1f" },
  degiro:        { label: "DEGIRO",           color: "#e8362d" },
  other:         { label: "Other",            color: "#94a3b8" },
};

const PLATFORM_OPTIONS = [
  { value: "bybit",         label: "Bybit" },
  { value: "mexc",          label: "MEXC" },
  { value: "trading-212",   label: "Trading 212" },
  { value: "ibkr",          label: "Interactive Brokers (IBKR)" },
  { value: "binance",       label: "Binance" },
  { value: "kraken",        label: "Kraken" },
  { value: "coinbase",      label: "Coinbase" },
  { value: "etoro",         label: "eToro" },
  { value: "revolut",       label: "Revolut" },
  { value: "degiro",        label: "DEGIRO" },
  { value: "other",         label: "Other / Manual" },
];

function platformMeta(key: string) {
  return PLATFORM_META[key.toLowerCase()] ?? { label: key, color: "#94a3b8" };
}

interface PriceData {
  price: number;
  change24h: number | null;
  live?: boolean;
}

const CLASS_META: Record<AssetClass, { label: string; color: string }> = {
  CRYPTO:    { label: "Crypto",    color: "#f7a600" },
  STOCK:     { label: "Stock",     color: "#6366f1" },
  ETF:       { label: "ETF",       color: "#00b897" },
  BOND:      { label: "Bond",      color: "#3b82f6" },
  COMMODITY: { label: "Commodity", color: "#f43f5e" },
  CASH:      { label: "Cash",      color: "#10b981" },
  OTHER:     { label: "Other",     color: "#94a3b8" },
};

// Stablecoins / USD always = $1
const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD", "USD"]);

// Fiat currency → Yahoo Finance forex symbol
const FIAT_TO_FOREX: Record<string, string> = {
  EUR: "EURUSD=X", GBP: "GBPUSD=X", CHF: "CHFUSD=X",
  JPY: "JPYUSD=X", AUD: "AUDUSD=X", CAD: "CADUSD=X",
  NZD: "NZDUSD=X", SEK: "SEKUSD=X", NOK: "NOKUSDT=X",
};


function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function pnlClass(v: number) {
  return v >= 0 ? "text-emerald-500" : "text-red-500";
}

// ── Modal ─────────────────────────────────────────────────────────────────────
interface ModalProps {
  initial?: Holding | null;
  onClose: () => void;
  onSaved: () => void;
}

function HoldingModal({ initial, onClose, onSaved }: ModalProps) {
  const [symbol,      setSymbol]      = useState(initial?.symbol       ?? "");
  const [name,        setName]        = useState(initial?.name         ?? "");
  const [assetClass,  setAssetClass]  = useState<AssetClass>(initial?.assetClass ?? "CRYPTO");
  const [platform,    setPlatform]    = useState(initial?.platform     ?? "other");
  const [priceSymbol, setPriceSymbol] = useState(initial?.priceSymbol  ?? "");
  const [leverage,    setLeverage]    = useState(initial?.leverage?.toString() ?? "");
  // Amount invested — displayed to user; quantity = amount / avgCost
  const [amount,   setAmount]   = useState(
    initial ? (initial.quantity * initial.avgCost).toFixed(2) : ""
  );
  const [avgCost,  setAvgCost]  = useState(initial?.avgCost?.toString() ?? "");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");

  const isCash = assetClass === "CASH";
  const symUpper = symbol.trim().toUpperCase();
  const isStablecoin = STABLECOINS.has(symUpper);

  // When switching to cash and symbol is a stablecoin, auto-fill price = 1
  function handleAssetClassChange(cls: AssetClass) {
    setAssetClass(cls);
    if (cls === "CASH" && STABLECOINS.has(symbol.trim().toUpperCase())) {
      setAvgCost("1");
    }
  }

  function handleSymbolChange(val: string) {
    const upper = val.trim().toUpperCase();
    setSymbol(upper);
    if (isCash && STABLECOINS.has(upper)) {
      setAvgCost("1");
    }
  }

  const amtNum  = parseFloat(amount);
  const priceNum = parseFloat(avgCost);
  const computedQty =
    amtNum > 0 && priceNum > 0 ? amtNum / priceNum : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!symbol.trim() || !amount || !avgCost)
      return setError("Symbol, amount and price are required.");
    if (!computedQty || computedQty <= 0)
      return setError("Amount and price must be positive numbers.");

    setSaving(true);
    try {
      const url    = initial ? `/api/holdings/${initial.id}` : "/api/holdings";
      const method = initial ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol:      symbol.trim().toUpperCase(),
          name:        name.trim() || symbol.trim().toUpperCase(),
          assetClass,
          platform,
          priceSymbol: priceSymbol.trim().toUpperCase() || null,
          leverage:    leverage ? parseInt(leverage, 10) : null,
          quantity:    computedQty,
          avgCost:     priceNum,
        }),
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

  // close on backdrop click
  const backdropRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-5">
          {initial ? "Edit Holding" : "Add Holding"}
        </h2>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Symbol */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {isCash ? "Currency / Token *" : "Symbol *"}
              </label>
              <input
                value={symbol}
                onChange={(e) => handleSymbolChange(e.target.value)}
                placeholder={isCash ? "USDT, EUR, USD…" : "BTC, AAPL, SPY…"}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Asset type */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Type *</label>
              <select
                value={assetClass}
                onChange={(e) => handleAssetClassChange(e.target.value as AssetClass)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {(Object.keys(CLASS_META) as AssetClass[]).map((c) => (
                  <option key={c} value={c}>{CLASS_META[c].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Platform */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Platform / Broker *</label>
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

          {/* Price symbol override — hidden for stablecoins */}
          {!isStablecoin && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Price Ticker{" "}
                <span className="font-normal text-slate-400">(if different from symbol)</span>
              </label>
              <input
                value={priceSymbol}
                onChange={(e) => setPriceSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. USOIL_USDT, BTC_USDT"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {priceSymbol && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {/_USDT$|_USDC$/i.test(priceSymbol)
                    ? "MEXC Futures contract"
                    : /USDT$|USDC$/i.test(priceSymbol)
                    ? "MEXC Spot pair"
                    : "Standard ticker (CoinGecko / Yahoo Finance)"}
                </p>
              )}
              {isCash && FIAT_TO_FOREX[symUpper] && !priceSymbol && (
                <p className="text-[10px] text-emerald-500 mt-1">
                  Live rate via Yahoo Finance forex ({FIAT_TO_FOREX[symUpper]})
                </p>
              )}
            </div>
          )}

          {/* Leverage — only for ETF / COMMODITY / OTHER */}
          {["ETF", "COMMODITY", "STOCK", "OTHER"].includes(assetClass) && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Leverage{" "}
                <span className="font-normal text-slate-400">(optional — e.g. 2, 3, -1 for inverse)</span>
              </label>
              <input
                type="number"
                step="1"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                placeholder="2 or 3 or -1…"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {leverage && (
                <p className="text-[10px] text-slate-400 mt-1">
                  {parseInt(leverage) < 0
                    ? `${Math.abs(parseInt(leverage))}× inverse (short)`
                    : `${leverage}× leveraged long`}
                </p>
              )}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bitcoin, Apple Inc., …"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Amount / Balance */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                {isCash ? "Balance Amount *" : "Amount Invested (USD) *"}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={isCash ? "1000" : "500"}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Avg buy price */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Price per Unit (USD) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder={isStablecoin ? "1" : "92.5"}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {isStablecoin && (
                <p className="text-[10px] text-slate-400 mt-1">Live price fetched from CoinGecko</p>
              )}
            </div>
          </div>

          {/* Calculated quantity preview */}
          {computedQty != null && (
            <p className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-2 rounded-lg">
              {isCash ? "Units:" : "Quantity:"}{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {computedQty.toLocaleString("en-US", { maximumFractionDigits: 8 })} {isStablecoin ? symUpper : "units"}
              </span>
              {!isStablecoin && <span className="ml-1 opacity-60">(= {amount} ÷ {avgCost})</span>}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/30 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Save Changes" : "Add Holding"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const [tab,        setTab]        = useState<"portfolio" | "trades">("portfolio");
  const [holdings,   setHoldings]   = useState<Holding[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal,      setModal]      = useState<"add" | "edit" | null>(null);
  const [editing,    setEditing]    = useState<Holding | null>(null);

  // Live prices: WebSocket for MEXC/Bybit, REST polling for everything else
  const prices = useLivePrices(holdings);

  const fetchHoldings = useCallback(async () => {
    const res = await fetch("/api/holdings");
    if (res.ok) return (await res.json()) as Holding[];
    return [];
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const hs = await fetchHoldings();
      setHoldings(hs);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchHoldings]);

  useEffect(() => { load(); }, [load]);

  // ── Computed ──
  const rows = holdings.map((h) => {
    const priceLookupKey = (h.priceSymbol || h.symbol).toUpperCase();
    const px = prices[priceLookupKey] as PriceData | undefined;
    const currentPrice  = px?.price ?? null;
    const lev           = h.leverage ?? 1;
    const absLev        = Math.abs(lev);
    // Exposure = what the position controls (margin × leverage)
    const currentValue  = currentPrice != null ? currentPrice * h.quantity * absLev : null;
    // Margin = actual cash invested (no leverage)
    const margin        = h.quantity * h.avgCost;
    // P&L respects leverage direction (negative = inverse)
    const pnl           = currentPrice != null ? (currentPrice - h.avgCost) * h.quantity * lev : null;
    const pnlPct        = currentPrice != null ? ((currentPrice - h.avgCost) / h.avgCost) * 100 * lev : null;
    return { ...h, currentPrice, currentValue, margin, pnl, pnlPct, change24h: px?.change24h ?? null, live: px?.live ?? false };
  });

  // Total uses current value for non-leveraged, margin for leveraged (to avoid inflating totals)
  const totalValue = rows.reduce((s, r) => {
    if (r.leverage != null && r.currentValue != null) return s + r.margin + (r.pnl ?? 0);
    return s + (r.currentValue ?? 0);
  }, 0);

  // allocation by asset class
  const byClass: Record<string, number> = {};
  for (const r of rows) {
    if (r.currentValue) byClass[r.assetClass] = (byClass[r.assetClass] ?? 0) + r.currentValue;
  }
  const allocation = Object.entries(byClass).map(([cls, value]) => ({
    key: cls,
    name: CLASS_META[cls as AssetClass]?.label ?? cls,
    color: CLASS_META[cls as AssetClass]?.color ?? "#94a3b8",
    value,
  }));

  // allocation by platform
  const byPlatform: Record<string, number> = {};
  for (const r of rows) {
    if (r.currentValue) byPlatform[r.platform] = (byPlatform[r.platform] ?? 0) + r.currentValue;
  }
  const platformAllocation = Object.entries(byPlatform).map(([key, value]) => {
    const pm = PLATFORM_META[key] ?? { label: key, color: "#94a3b8" };
    return { key, name: pm.label, color: pm.color, value };
  });

  async function deleteHolding(id: string) {
    if (!confirm("Remove this holding?")) return;
    await fetch(`/api/holdings/${id}`, { method: "DELETE" });
    load(true);
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="h-40 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
        <div className="h-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      {(modal === "add" || modal === "edit") && (
        <HoldingModal
          initial={modal === "edit" ? editing : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(true); }}
        />
      )}

      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Investments</h1>
            <p className="text-sm text-slate-500 mt-0.5">Live via MEXC & Bybit WebSocket · CoinGecko & Yahoo Finance</p>
          </div>
          <div className="flex gap-2">
            {tab === "portfolio" && (
              <>
                <button
                  onClick={() => load(true)}
                  disabled={refreshing}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "animate-spin" : ""}>
                    <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                  </svg>
                  {refreshing ? "Refreshing…" : "Reload Holdings"}
                </button>
                <button
                  onClick={() => setModal("add")}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Holding
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
          {(["portfolio", "trades"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                tab === t
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t === "portfolio" ? "Portfolio" : "Trade History"}
            </button>
          ))}
        </div>

        {tab === "trades" && <TradesTab />}

        {tab === "portfolio" && rows.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-5xl mb-4">📈</div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">No holdings yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-6">Add your first asset to start tracking your portfolio</p>
            <button
              onClick={() => setModal("add")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add your first holding
            </button>
          </div>
        ) : tab === "portfolio" ? (
          <>
            {/* Total value banner */}
            <div className="mb-6 rounded-xl bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Total Portfolio Value</p>
                <p className="text-3xl font-bold">{fmt(totalValue)}</p>
                <p className="text-xs text-slate-400 mt-1">{rows.length} holding{rows.length !== 1 ? "s" : ""}</p>
              </div>
              {allocation.length > 0 && (
                <div className="hidden md:block">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={allocation} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                        {allocation.map((a, i) => (
                          <Cell key={i} fill={a.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => [fmt(Number(v)), undefined]}
                        contentStyle={{ fontSize: "11px", borderRadius: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Holdings table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Asset</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Qty</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Buy</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Current</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">P&L</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">24h</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                    {rows.map((r) => {
                      const meta  = CLASS_META[r.assetClass] ?? CLASS_META.OTHER;
                      const pmeta = platformMeta(r.platform);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                          {/* Asset */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                style={{ backgroundColor: meta.color }}
                              >
                                {r.symbol.slice(0, 2)}
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <p className="font-semibold text-slate-800 dark:text-slate-100 text-xs">{r.symbol}</p>
                                  {r.name !== r.symbol && (
                                    <span className="text-xs text-slate-400">{r.name}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                  {/* Asset class badge */}
                                  <span
                                    className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
                                    style={{ backgroundColor: meta.color + "cc" }}
                                  >
                                    {meta.label}
                                  </span>
                                  {/* Leverage badge */}
                                  {r.leverage != null && (
                                    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                                      {r.leverage < 0 ? `${Math.abs(r.leverage)}× INV` : `${r.leverage}×`}
                                    </span>
                                  )}
                                  {/* Platform badge */}
                                  <span
                                    className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                                    style={{ color: pmeta.color, borderColor: pmeta.color + "66", backgroundColor: pmeta.color + "18" }}
                                  >
                                    {pmeta.label}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Qty */}
                          <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {r.quantity.toLocaleString("en-US", { maximumFractionDigits: 8 })}
                          </td>

                          {/* Avg buy */}
                          <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {fmt(r.avgCost)}
                          </td>

                          {/* Current price */}
                          <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                            {r.currentPrice != null ? (
                              <div className="flex items-center justify-end gap-1">
                                {r.live && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live price" />
                                )}
                                {fmt(r.currentPrice)}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Value / Exposure */}
                          <td className="px-4 py-3 text-right text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                            {r.currentValue != null ? (
                              <div>
                                <div>{fmt(r.currentValue)}</div>
                                {r.leverage != null && (
                                  <div className="text-[10px] font-normal text-slate-400">
                                    margin {fmt(r.margin)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* P&L */}
                          <td className="px-4 py-3 text-right text-xs tabular-nums">
                            {r.pnl != null && r.pnlPct != null ? (
                              <div className={pnlClass(r.pnl)}>
                                <div className="font-semibold">{r.pnl >= 0 ? "+" : ""}{fmt(r.pnl)}</div>
                                <div className="text-[10px] opacity-80">{fmtPct(r.pnlPct)}</div>
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* 24h change */}
                          <td className="px-4 py-3 text-right text-xs tabular-nums">
                            {r.change24h != null ? (
                              <span className={pnlClass(r.change24h)}>{fmtPct(r.change24h)}</span>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-600">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => { setEditing(r); setModal("edit"); }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="Edit"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteHolding(r.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                                title="Delete"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                                </svg>
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

            {/* Allocation Charts */}
            {allocation.length > 0 && (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* By Asset Class */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">By Asset Class</p>
                  <div className="flex items-center gap-6">
                    <div className="shrink-0">
                      <ResponsiveContainer width={140} height={140}>
                        <PieChart>
                          <Pie data={allocation} cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value">
                            {allocation.map((a, i) => (
                              <Cell key={i} fill={a.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v) => [fmt(Number(v)), undefined]}
                            contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {allocation.map((a) => {
                        const pct = totalValue > 0 ? (a.value / totalValue) * 100 : 0;
                        return (
                          <div key={a.key}>
                            <div className="flex justify-between items-center mb-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{a.name}</span>
                              </div>
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{pct.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                              <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: a.color }} />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{fmt(a.value)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* By Platform */}
                {platformAllocation.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">By Platform</p>
                    <div className="flex items-center gap-6">
                      <div className="shrink-0">
                        <ResponsiveContainer width={140} height={140}>
                          <PieChart>
                            <Pie data={platformAllocation} cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value">
                              {platformAllocation.map((a, i) => (
                                <Cell key={i} fill={a.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v) => [fmt(Number(v)), undefined]}
                              contentStyle={{ fontSize: "11px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2">
                        {platformAllocation.map((a) => {
                          const pct = totalValue > 0 ? (a.value / totalValue) * 100 : 0;
                          return (
                            <div key={a.key}>
                              <div className="flex justify-between items-center mb-0.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{a.name}</span>
                                </div>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{pct.toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                                <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: a.color }} />
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">{fmt(a.value)}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
