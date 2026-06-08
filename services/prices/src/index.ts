import express, { Request, Response } from "express";
import { getCryptoPrices } from "./providers/coingecko";
import { getStockPrices } from "./providers/yahoo";
import { getMexcPairPrices } from "./providers/mexc-public";
import { getMexcFuturesPrices } from "./providers/mexc-futures";
import { getFromCache, setCache } from "./cache";

const app = express();
const PORT = process.env.PORT ?? 3001;
const CACHE_TTL = 60; // seconds

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "prices" });
});

app.get("/prices", async (req: Request, res: Response) => {
  const cryptoParam  = (req.query.crypto   as string) ?? "";
  const stockParam   = (req.query.stocks   as string) ?? "";
  const pairsParam   = (req.query.pairs    as string) ?? "";
  const futuresParam = (req.query.futures  as string) ?? "";

  const cryptoSymbols  = cryptoParam  ? cryptoParam.split(",").filter(Boolean)  : [];
  const stockSymbols   = stockParam   ? stockParam.split(",").filter(Boolean)   : [];
  const pairSymbols    = pairsParam   ? pairsParam.split(",").filter(Boolean)   : [];
  const futuresSymbols = futuresParam ? futuresParam.split(",").filter(Boolean) : [];

  const cacheKey = `prices:${cryptoParam}|${stockParam}|${pairsParam}|${futuresParam}`;
  const cached = await getFromCache(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.json(JSON.parse(cached));
  }

  try {
    const [cryptoPrices, stockPrices, pairPrices, futuresPrices] = await Promise.all([
      cryptoSymbols.length  > 0 ? getCryptoPrices(cryptoSymbols)       : {},
      stockSymbols.length   > 0 ? getStockPrices(stockSymbols)         : {},
      pairSymbols.length    > 0 ? getMexcPairPrices(pairSymbols)       : {},
      futuresSymbols.length > 0 ? getMexcFuturesPrices(futuresSymbols) : {},
    ]);

    const result = {
      ...cryptoPrices,
      ...stockPrices,
      ...pairPrices,
      ...futuresPrices,
    };

    await setCache(cacheKey, JSON.stringify(result), CACHE_TTL);
    res.setHeader("X-Cache", "MISS");
    res.json(result);
  } catch (err) {
    console.error("[prices] fetch error:", err);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

app.listen(PORT, () => {
  console.log(`[prices-service] listening on :${PORT}`);
});
