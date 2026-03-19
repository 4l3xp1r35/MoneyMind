import { createHmac } from "crypto";
import type { Holding } from "./types";

const BASE = "https://api.bybit.com";

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function headers(apiKey: string, apiSecret: string, queryString: string) {
  const ts = Date.now().toString();
  const recvWindow = "5000";
  const sig = sign(`${ts}${apiKey}${recvWindow}${queryString}`, apiSecret);
  return {
    "X-BAPI-API-KEY": apiKey,
    "X-BAPI-SIGN": sig,
    "X-BAPI-SIGN-METHOD": "HMAC-SHA256",
    "X-BAPI-TIMESTAMP": ts,
    "X-BAPI-RECV-WINDOW": recvWindow,
  };
}

export async function fetchBybit(apiKey: string, apiSecret: string): Promise<Holding[]> {
  // Try UNIFIED first, fall back to SPOT
  const accountTypes = ["UNIFIED", "SPOT"];

  for (const accountType of accountTypes) {
    const qs = `accountType=${accountType}`;
    const res = await fetch(`${BASE}/v5/account/wallet-balance?${qs}`, {
      headers: headers(apiKey, apiSecret, qs),
    });

    const data = await res.json();
    if (data.retCode !== 0) {
      if (accountType === "SPOT") throw new Error(data.retMsg ?? "Bybit API error");
      continue;
    }

    const coins: Record<string, unknown>[] = data.result?.list?.[0]?.coin ?? [];

    return coins
      .filter((c) => parseFloat(c.walletBalance as string) > 0)
      .map((c) => ({
        symbol: c.coin as string,
        name: c.coin as string,
        quantity: parseFloat(c.walletBalance as string),
        currentPrice: parseFloat(c.usdValue as string) > 0 && parseFloat(c.walletBalance as string) > 0
          ? parseFloat(c.usdValue as string) / parseFloat(c.walletBalance as string)
          : null,
        currentValue: parseFloat(c.usdValue as string) || null,
        unrealizedPnl: parseFloat(c.unrealisedPnl as string) || null,
        assetType: "crypto" as const,
      }));
  }

  return [];
}
