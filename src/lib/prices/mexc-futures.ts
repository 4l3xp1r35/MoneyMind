export type PriceData = { price: number; change24h: number | null };

// MEXC Perpetual Futures public API — no auth needed
// Symbol format: USOIL_USDT, BTC_USDT, ETH_USDT, etc.
export async function getMexcFuturesPrices(
  symbols: string[]
): Promise<Record<string, PriceData>> {
  if (symbols.length === 0) return {};

  const results = await Promise.all(
    symbols.map(async (symbol): Promise<[string, PriceData | null]> => {
      try {
        const res = await fetch(
          `https://contract.mexc.com/api/v1/contract/ticker?symbol=${encodeURIComponent(symbol)}`,
          { next: { revalidate: 60 } }
        );
        if (!res.ok) return [symbol, null];
        const json = await res.json();
        const ticker = json?.data;
        if (!ticker?.lastPrice) return [symbol, null];

        const price: number = ticker.lastPrice;
        // riseFallRate is a decimal like -0.0203 = -2.03%
        const change24h: number | null =
          ticker.riseFallRate != null ? ticker.riseFallRate * 100 : null;

        return [symbol.toUpperCase(), { price, change24h }];
      } catch {
        return [symbol, null];
      }
    })
  );

  const out: Record<string, PriceData> = {};
  for (const [sym, data] of results) {
    if (data) out[sym] = data;
  }
  return out;
}
