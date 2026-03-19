export type PriceData = { price: number; change24h: number | null };

export async function getStockPrices(
  symbols: string[]
): Promise<Record<string, PriceData>> {
  if (symbols.length === 0) return {};

  const results = await Promise.all(
    symbols.map(async (symbol): Promise<[string, PriceData | null]> => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
          next: { revalidate: 60 },
        });
        if (!res.ok) return [symbol, null];

        const json = await res.json();
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta?.regularMarketPrice) return [symbol, null];

        const price = meta.regularMarketPrice as number;
        const prev: number | undefined =
          meta.previousClose ?? meta.chartPreviousClose;
        const change24h = prev != null ? ((price - prev) / prev) * 100 : null;
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
