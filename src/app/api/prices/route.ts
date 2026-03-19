import { NextRequest, NextResponse } from "next/server";
import { getCryptoPrices } from "@/lib/prices/coingecko";
import { getStockPrices } from "@/lib/prices/yahoo";
import { getMexcPairPrices } from "@/lib/prices/mexc-public";
import { getMexcFuturesPrices } from "@/lib/prices/mexc-futures";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cryptoParam   = searchParams.get("crypto")   ?? "";
  const stockParam    = searchParams.get("stocks")   ?? "";
  const pairsParam    = searchParams.get("pairs")    ?? ""; // USDT spot pairs → MEXC spot
  const futuresParam  = searchParams.get("futures")  ?? ""; // _USDT futures → MEXC contracts

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
