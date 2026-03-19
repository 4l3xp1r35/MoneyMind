import type { Holding } from "./types";

export async function fetchTrading212(
  apiKey: string,
  mode: "live" | "demo" = "live"
): Promise<Holding[]> {
  const base =
    mode === "demo"
      ? "https://demo.trading212.com"
      : "https://live.trading212.com";

  const headers = { Authorization: apiKey };

  // Fetch open positions
  const [posRes, cashRes] = await Promise.all([
    fetch(`${base}/api/v0/equity/portfolio`, { headers }),
    fetch(`${base}/api/v0/equity/account/cash`, { headers }),
  ]);

  if (posRes.status === 401) throw new Error("Invalid Trading 212 API key");
  if (!posRes.ok) throw new Error(`Trading 212 error: ${posRes.status}`);

  const positions: Record<string, unknown>[] = await posRes.json();

  const holdings: Holding[] = positions.map((p) => ({
    symbol: p.ticker as string,
    name: (p.ticker as string).replace(/_EQ$/, ""),
    quantity: parseFloat(p.quantity as string),
    currentPrice: parseFloat(p.currentPrice as string) || null,
    currentValue: parseFloat(p.currentPrice as string) * parseFloat(p.quantity as string) || null,
    unrealizedPnl: parseFloat(p.ppl as string) || null,
    assetType: "stock" as const,
  }));

  // Add cash balance as a holding
  if (cashRes.ok) {
    const cash = await cashRes.json();
    const cashAmount = parseFloat(cash.free as string) || 0;
    if (cashAmount > 0) {
      holdings.push({
        symbol: "CASH",
        name: "Cash",
        quantity: cashAmount,
        currentPrice: 1,
        currentValue: cashAmount,
        unrealizedPnl: null,
        assetType: "cash" as const,
      });
    }
  }

  return holdings;
}
