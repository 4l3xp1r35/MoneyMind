import { createHmac } from "crypto";
import type { Holding } from "./types";

const BASE = "https://api.mexc.com";

function sign(queryString: string, secret: string) {
  return createHmac("sha256", secret).update(queryString).digest("hex");
}

async function getMexcPrice(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/api/v3/ticker/price?symbol=${symbol}USDT`);
    if (!res.ok) return null;
    const data = await res.json();
    return parseFloat(data.price) || null;
  } catch {
    return null;
  }
}

export async function fetchMexc(apiKey: string, apiSecret: string): Promise<Holding[]> {
  const timestamp = Date.now();
  const qs = `timestamp=${timestamp}`;
  const sig = sign(qs, apiSecret);

  const res = await fetch(`${BASE}/api/v3/account?${qs}&signature=${sig}`, {
    headers: { "X-MEXC-APIKEY": apiKey },
  });

  const data = await res.json();
  if (data.code) throw new Error(data.msg ?? "MEXC API error");

  const nonZero = (data.balances ?? []).filter(
    (b: Record<string, string>) => parseFloat(b.free) + parseFloat(b.locked) > 0
  );

  // Fetch prices in parallel (skip USDT itself)
  const holdings: Holding[] = await Promise.all(
    nonZero.map(async (b: Record<string, string>) => {
      const qty = parseFloat(b.free) + parseFloat(b.locked);
      const isStable = ["USDT", "USDC", "BUSD", "DAI"].includes(b.asset);
      const price = isStable ? 1 : await getMexcPrice(b.asset);
      return {
        symbol: b.asset,
        name: b.asset,
        quantity: qty,
        currentPrice: price,
        currentValue: price !== null ? qty * price : null,
        unrealizedPnl: null,
        assetType: "crypto" as const,
      };
    })
  );

  return holdings;
}
