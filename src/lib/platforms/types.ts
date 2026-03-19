export interface Holding {
  symbol: string;
  name: string;
  quantity: number;
  currentPrice: number | null;   // price per unit in USD
  currentValue: number | null;   // total value in USD
  unrealizedPnl: number | null;
  assetType: "crypto" | "stock" | "etf" | "cash" | "other";
}

export interface PlatformResult {
  platformId: string;
  label: string;
  name: string;
  success: boolean;
  holdings: Holding[];
  totalValueUsd: number;
  error?: string;
  fetchedAt: string;
}
