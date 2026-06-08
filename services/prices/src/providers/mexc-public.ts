export type PriceData = { price: number; change24h: number | null };

function normalize(symbol: string): string {
  return symbol.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

export async function getMexcPairPrices(
  symbols: string[]
): Promise<Record<string, PriceData>> {
  if (symbols.length === 0) return {};

  const normalized = symbols.map(normalize);

  const promises = normalized.map(
    async (sym, i): Promise<[string, PriceData | null]> => {
      try {
        const res = await fetch(
          `https://api.mexc.com/api/v3/ticker/24hr?symbol=${sym}`
        );
        if (!res.ok) return [symbols[i], null];
        const data = await res.json();
        const price = parseFloat(data.lastPrice ?? data.prevClosePrice ?? "0");
        const changePct = parseFloat(data.priceChangePercent ?? "0");
        if (!price) return [symbols[i], null];
        return [symbols[i].toUpperCase(), { price, change24h: changePct }];
      } catch {
        return [symbols[i], null];
      }
    }
  );

  const results = await Promise.all(promises);
  const out: Record<string, PriceData> = {};
  for (const [sym, data] of results) {
    if (data) out[sym] = data;
  }
  return out;
}
