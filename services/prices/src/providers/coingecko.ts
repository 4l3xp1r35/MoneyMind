const SYMBOL_TO_ID: Record<string, string> = {
  BTC:   "bitcoin",
  ETH:   "ethereum",
  SOL:   "solana",
  BNB:   "binancecoin",
  XRP:   "ripple",
  ADA:   "cardano",
  DOGE:  "dogecoin",
  AVAX:  "avalanche-2",
  DOT:   "polkadot",
  LINK:  "chainlink",
  MATIC: "matic-network",
  POL:   "matic-network",
  UNI:   "uniswap",
  LTC:   "litecoin",
  BCH:   "bitcoin-cash",
  ATOM:  "cosmos",
  FIL:   "filecoin",
  TRX:   "tron",
  NEAR:  "near",
  ARB:   "arbitrum",
  OP:    "optimism",
  APT:   "aptos",
  SUI:   "sui",
  INJ:   "injective-protocol",
  USDT:  "tether",
  USDC:  "usd-coin",
  DAI:   "dai",
  PEPE:  "pepe",
  SHIB:  "shiba-inu",
};

export type PriceData = { price: number; change24h: number | null };

export async function getCryptoPrices(
  symbols: string[]
): Promise<Record<string, PriceData>> {
  if (symbols.length === 0) return {};

  const upper = symbols.map((s) => s.toUpperCase());
  const ids = upper.map((s) => SYMBOL_TO_ID[s] ?? s.toLowerCase());

  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`CoinGecko error ${res.status}`);

  const data: Record<string, { usd?: number; usd_24h_change?: number }> =
    await res.json();

  const result: Record<string, PriceData> = {};
  for (let i = 0; i < upper.length; i++) {
    const sym = upper[i];
    const id = ids[i];
    const row = data[id];
    if (row?.usd !== undefined) {
      result[sym] = { price: row.usd, change24h: row.usd_24h_change ?? null };
    }
  }
  return result;
}
