import { NextRequest, NextResponse } from "next/server";
import { getCryptoPrices } from "@/lib/prices/coingecko";
import { getStockPrices } from "@/lib/prices/yahoo";
import { getMexcPairPrices } from "@/lib/prices/mexc-public";
import { getMexcFuturesPrices } from "@/lib/prices/mexc-futures";

// When PRICES_SERVICE_URL is set (Docker / production), forward the request
// to the dedicated prices microservice which caches results in Redis.
// Falls back to direct external API calls for local dev (no Docker needed).
const PRICES_SERVICE_URL = process.env.PRICES_SERVICE_URL;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  if (PRICES_SERVICE_URL) {
    const qs = searchParams.toString();
    const res = await fetch(`${PRICES_SERVICE_URL}/prices?${qs}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "prices-service unavailable" },
        { status: 502 }
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  }

  // ── Fallback: direct calls (local dev without Docker) ─────────────────────
  const cryptoParam   = searchParams.get("crypto")   ?? "";
  const stockParam    = searchParams.get("stocks")   ?? "";
  const pairsParam    = searchParams.get("pairs")    ?? "";
  const futuresParam  = searchParams.get("futures")  ?? "";

  const cryptoSymbols  = cryptoParam  ? cryptoParam.split(",").filter(Boolean)  : [];
  const stockSymbols   = stockParam   ? stockParam.split(",").filter(Boolean)   : [];
  const pairSymbols    = pairsParam   ? pairsParam.split(",").filter(Boolean)   : [];
  const futuresSymbols = futuresParam ? futuresParam.split(",").filter(Boolean) : [];

  const [cryptoPrices, stockPrices, pairPrices, futuresPrices] = await Promise.all([
    cryptoSymbols.length  > 0 ? getCryptoPrices(cryptoSymbols)       : {},
    stockSymbols.length   > 0 ? getStockPrices(stockSymbols)         : {},
    pairSymbols.length    > 0 ? getMexcPairPrices(pairSymbols)       : {},
    futuresSymbols.length > 0 ? getMexcFuturesPrices(futuresSymbols) : {},
  ]);

  return NextResponse.json({
    ...cryptoPrices,
    ...stockPrices,
    ...pairPrices,
    ...futuresPrices,
  });
}
