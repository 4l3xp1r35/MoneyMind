"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface PriceData {
  price: number;
  change24h: number | null;
  live: boolean; // true = WebSocket, false = REST
}

interface HoldingInput {
  symbol: string;
  assetClass: string;
  platform: string;
  priceSymbol: string | null;
}

// ── Routing helpers ────────────────────────────────────────────────────────────

const STABLECOINS = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "FDUSD", "USD"]);

const FIAT_TO_FOREX: Record<string, string> = {
  EUR: "EURUSD=X", GBP: "GBPUSD=X", CHF: "CHFUSD=X",
  JPY: "JPYUSD=X", AUD: "AUDUSD=X", CAD: "CADUSD=X",
  NZD: "NZDUSD=X", SEK: "SEKUSD=X", NOK: "NOKUSDT=X",
};

function effectiveSym(h: HoldingInput) {
  return (h.priceSymbol || h.symbol).toUpperCase();
}

function isFuturesSym(s: string) {
  return /_USDT$/i.test(s) || /_USDC$/i.test(s);
}

function isSpotPairSym(s: string) {
  return !isFuturesSym(s) && (/USDT$/i.test(s) || /USDC$/i.test(s)) && s.length > 4;
}

// ── Generic reconnecting WebSocket ────────────────────────────────────────────

interface WsConfig {
  key: string;          // stable string; changing it reconnects
  url: string;
  pingMsg: string;
  pingMs: number;
  onOpen: (ws: WebSocket) => void;
  onMessage: (raw: string) => void;
}

function useReconnectWs({ key, url, pingMsg, pingMs, onOpen, onMessage }: WsConfig) {
  // keep callbacks in refs so the effect doesn't re-run when they change
  const onOpenRef    = useRef(onOpen);
  const onMessageRef = useRef(onMessage);
  useEffect(() => { onOpenRef.current    = onOpen;    });
  useEffect(() => { onMessageRef.current = onMessage; });

  useEffect(() => {
    if (!key) return; // nothing to subscribe to

    let ws: WebSocket;
    let pingId: ReturnType<typeof setInterval>;
    let retryId: ReturnType<typeof setTimeout>;
    let alive = true;

    function connect() {
      if (!alive) return;
      ws = new WebSocket(url);

      ws.onopen = () => {
        onOpenRef.current(ws);
        pingId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(pingMsg);
        }, pingMs);
      };

      ws.onmessage = (e) => onMessageRef.current(e.data);

      ws.onerror  = () => ws.close();
      ws.onclose  = () => {
        clearInterval(pingId);
        if (alive) retryId = setTimeout(connect, 3_000);
      };
    }

    connect();

    return () => {
      alive = false;
      clearInterval(pingId);
      clearTimeout(retryId);
      ws?.close();
    };
  // key changes when the symbol set changes → reconnect with new subscriptions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, url]);
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useLivePrices(holdings: HoldingInput[]): Record<string, PriceData> {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});

  const setPrice = useCallback((sym: string, data: PriceData) => {
    setPrices((prev) => ({ ...prev, [sym.toUpperCase()]: data }));
  }, []);

  // Partition holdings into groups (memoised, only recomputes when holdings change)
  const { mexcSpot, mexcFutures, bybitSpot, bybitLinear, restHoldings, forexMap } =
    useMemo(() => {
      const mexcSpot: string[]      = [];
      const mexcFutures: string[]   = [];
      const bybitSpot: string[]     = [];
      const bybitLinear: string[]   = [];
      const restHoldings: HoldingInput[] = [];
      const forexMap: Record<string, string> = {};

      for (const h of holdings) {
        const sym = effectiveSym(h);

        // Stablecoin CASH (USDT, USDC…) → CoinGecko REST, regardless of platform
        if (STABLECOINS.has(sym)) {
          restHoldings.push(h);
          continue;
        }

        // Fiat CASH → Yahoo forex (REST)
        if (h.assetClass === "CASH" && FIAT_TO_FOREX[sym]) {
          forexMap[sym] = FIAT_TO_FOREX[sym];
          restHoldings.push(h);
          continue;
        }

        if (h.platform === "bybit") {
          if (isFuturesSym(sym)) bybitLinear.push(sym);
          else                   bybitSpot.push(sym);
        } else if (h.platform === "mexc") {
          if (isFuturesSym(sym))      mexcFutures.push(sym);
          else if (isSpotPairSym(sym)) mexcSpot.push(sym);
          else                         restHoldings.push(h);
        } else {
          restHoldings.push(h);
        }
      }

      return {
        mexcSpot:    [...new Set(mexcSpot)],
        mexcFutures: [...new Set(mexcFutures)],
        bybitSpot:   [...new Set(bybitSpot)],
        bybitLinear: [...new Set(bybitLinear)],
        restHoldings,
        forexMap,
      };
    }, [holdings]);

  // stable string keys used as useEffect deps
  const mexcSpotKey    = mexcSpot.sort().join(",");
  const mexcFuturesKey = mexcFutures.sort().join(",");
  const bybitSpotKey   = bybitSpot.sort().join(",");
  const bybitLinearKey = bybitLinear.sort().join(",");

  // Bybit linear symbols without underscore (MEXC style BTC_USDT → Bybit BTCUSDT)
  const bybitLinearMap = useMemo(() =>
    bybitLinear.map((s) => ({ stored: s, bybit: s.replace(/_/g, "") })),
    [bybitLinear]
  );

  // ── MEXC Spot ──────────────────────────────────────────────────────────────
  useReconnectWs({
    key:      mexcSpotKey,
    url:      "wss://wbs.mexc.com/ws",
    pingMsg:  JSON.stringify({ method: "PING" }),
    pingMs:   25_000,
    onOpen(ws) {
      ws.send(JSON.stringify({
        method: "SUBSCRIPTION",
        params: mexcSpot.map((s) => `spot@public.miniTicker.v3.api@${s}`),
      }));
    },
    onMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        // d.c = close/current price, d.r = change ratio (decimal)
        if (msg.d?.s && (msg.d.c ?? msg.d.p)) {
          setPrice(msg.d.s, {
            price:     parseFloat(msg.d.c ?? msg.d.p),
            change24h: msg.d.r != null ? parseFloat(msg.d.r) * 100 : null,
            live:      true,
          });
        }
      } catch { /* ignore malformed frames */ }
    },
  });

  // ── MEXC Futures ───────────────────────────────────────────────────────────
  useReconnectWs({
    key:      mexcFuturesKey,
    url:      "wss://contract.mexc.com/edge",
    pingMsg:  JSON.stringify({ method: "ping" }),
    pingMs:   20_000,
    onOpen(ws) {
      for (const sym of mexcFutures) {
        ws.send(JSON.stringify({ method: "sub.ticker", param: { symbol: sym } }));
      }
    },
    onMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.channel === "push.ticker" && msg.data?.lastPrice != null) {
          setPrice(msg.data.symbol, {
            price:     Number(msg.data.lastPrice),
            change24h: msg.data.riseFallRate != null
              ? Number(msg.data.riseFallRate) * 100
              : null,
            live: true,
          });
        }
      } catch { /* ignore */ }
    },
  });

  // ── Bybit Spot ─────────────────────────────────────────────────────────────
  useReconnectWs({
    key:      bybitSpotKey,
    url:      "wss://stream.bybit.com/v5/public/spot",
    pingMsg:  JSON.stringify({ op: "ping" }),
    pingMs:   20_000,
    onOpen(ws) {
      ws.send(JSON.stringify({
        op:   "subscribe",
        args: bybitSpot.map((s) => `tickers.${s}`),
      }));
    },
    onMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.topic?.startsWith("tickers.") && msg.data?.lastPrice) {
          setPrice(msg.data.symbol, {
            price:     parseFloat(msg.data.lastPrice),
            change24h: msg.data.price24hPcnt != null
              ? parseFloat(msg.data.price24hPcnt) * 100
              : null,
            live: true,
          });
        }
      } catch { /* ignore */ }
    },
  });

  // ── Bybit Linear (USDT perps) ──────────────────────────────────────────────
  useReconnectWs({
    key:      bybitLinearKey,
    url:      "wss://stream.bybit.com/v5/public/linear",
    pingMsg:  JSON.stringify({ op: "ping" }),
    pingMs:   20_000,
    onOpen(ws) {
      ws.send(JSON.stringify({
        op:   "subscribe",
        args: bybitLinearMap.map(({ bybit }) => `tickers.${bybit}`),
      }));
    },
    onMessage(raw) {
      try {
        const msg = JSON.parse(raw);
        if (msg.topic?.startsWith("tickers.") && msg.data?.lastPrice) {
          const bybitSym  = msg.data.symbol.toUpperCase();
          // Map back to stored key (e.g. BTCUSDT → BTC_USDT)
          const storedSym = bybitLinearMap.find(({ bybit }) => bybit === bybitSym)?.stored ?? bybitSym;
          setPrice(storedSym, {
            price:     parseFloat(msg.data.lastPrice),
            change24h: msg.data.price24hPcnt != null
              ? parseFloat(msg.data.price24hPcnt) * 100
              : null,
            live: true,
          });
        }
      } catch { /* ignore */ }
    },
  });

  // ── REST fallback (CoinGecko · Yahoo Finance · stablecoins) ───────────────
  const restKey = restHoldings.map((h) => effectiveSym(h)).sort().join(",");

  useEffect(() => {
    if (!restKey) return;

    async function fetchRest() {
      const crypto: string[]  = [];
      const stocks: string[]  = [];
      const forexSyms: string[] = [];

      for (const h of restHoldings) {
        const sym = effectiveSym(h);
        if (h.assetClass === "CASH" && STABLECOINS.has(sym)) {
          crypto.push(sym);
        } else if (FIAT_TO_FOREX[sym]) {
          forexSyms.push(FIAT_TO_FOREX[sym]);
        } else if (h.assetClass === "CRYPTO") {
          crypto.push(sym);
        } else {
          stocks.push(sym);
        }
      }

      const params = new URLSearchParams();
      if (crypto.length)                    params.set("crypto",  [...new Set(crypto)].join(","));
      if (stocks.length || forexSyms.length) params.set("stocks", [...new Set([...stocks, ...forexSyms])].join(","));
      if (!params.toString()) return;

      try {
        const res = await fetch(`/api/prices?${params}`);
        if (!res.ok) return;
        const data: Record<string, { price: number; change24h: number | null }> = await res.json();

        // Re-key forex results (EURUSD=X → EUR)
        for (const [orig, yahoo] of Object.entries(forexMap)) {
          const row = data[yahoo.toUpperCase()];
          if (row) setPrice(orig, { ...row, live: false });
        }

        const yahooKeys = new Set(Object.values(forexMap).map((s) => s.toUpperCase()));
        for (const [key, val] of Object.entries(data)) {
          if (!yahooKeys.has(key)) setPrice(key, { ...val, live: false });
        }
      } catch { /* ignore */ }
    }

    fetchRest();
    const id = setInterval(fetchRest, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restKey]);

  return prices;
}
