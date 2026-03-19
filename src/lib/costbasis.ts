export type Direction = "BUY" | "SELL";
export type Method    = "FIFO" | "LIFO" | "AVG";

export interface TradeLot {
  direction: Direction;
  quantity:  number;
  price:     number;
  fees:      number;
  tradedAt:  Date;
}

export interface CostBasisResult {
  realizedPnL:  number;
  totalFees:    number;
  totalBought:  number;
  totalSold:    number;
  currentQty:   number;
  avgCost:      number; // weighted avg cost of open lots
}

interface OpenLot {
  qty:      number;
  costPer:  number;
}

export function computeCostBasis(
  rawTrades: TradeLot[],
  method: Method
): CostBasisResult {
  const trades = [...rawTrades].sort(
    (a, b) => a.tradedAt.getTime() - b.tradedAt.getTime()
  );

  let realizedPnL = 0;
  let totalFees   = 0;
  let totalBought = 0;
  let totalSold   = 0;

  if (method === "AVG") {
    let runningQty  = 0;
    let runningCost = 0; // total cost basis of open position

    for (const t of trades) {
      totalFees += t.fees;
      if (t.direction === "BUY") {
        runningQty  += t.quantity;
        runningCost += t.quantity * t.price + t.fees;
        totalBought += t.quantity;
      } else {
        const avgCostPer = runningQty > 0 ? runningCost / runningQty : 0;
        realizedPnL += t.quantity * (t.price - avgCostPer) - t.fees;
        runningQty  -= t.quantity;
        runningCost -= t.quantity * avgCostPer;
        if (runningQty < 0) runningQty = 0;
        if (runningCost < 0) runningCost = 0;
        totalSold   += t.quantity;
      }
    }

    const currentQty = Math.max(0, totalBought - totalSold);
    const avgCost    = currentQty > 0 ? runningCost / currentQty : 0;
    return { realizedPnL, totalFees, totalBought, totalSold, currentQty, avgCost };
  }

  // FIFO or LIFO — maintain a lot queue/stack
  const lots: OpenLot[] = [];

  for (const t of trades) {
    totalFees += t.fees;
    if (t.direction === "BUY") {
      totalBought += t.quantity;
      const lot: OpenLot = { qty: t.quantity, costPer: t.price + t.fees / t.quantity };
      if (method === "FIFO") {
        lots.push(lot);             // enqueue at back
      } else {
        lots.push(lot);             // also push for LIFO (we pop from back)
      }
    } else {
      totalSold += t.quantity;
      let remaining = t.quantity;
      const sellFeePerUnit = t.fees / t.quantity;

      while (remaining > 0 && lots.length > 0) {
        const lot = method === "FIFO" ? lots[0] : lots[lots.length - 1];
        const used = Math.min(lot.qty, remaining);
        realizedPnL += used * (t.price - lot.costPer - sellFeePerUnit);
        lot.qty     -= used;
        remaining   -= used;
        if (lot.qty <= 1e-12) {
          method === "FIFO" ? lots.shift() : lots.pop();
        }
      }
    }
  }

  const currentQty = lots.reduce((s, l) => s + l.qty, 0);
  const totalCost  = lots.reduce((s, l) => s + l.qty * l.costPer, 0);
  const avgCost    = currentQty > 0 ? totalCost / currentQty : 0;

  return { realizedPnL, totalFees, totalBought, totalSold, currentQty, avgCost };
}

// ── Sync helper — recompute a holding from its full trade history ─────────────
import type { PrismaClient } from "@prisma/client";

export async function syncHolding(
  prisma: PrismaClient,
  userId: string,
  assetId: string,
  platform: string
) {
  const holding = await prisma.holding.findUnique({
    where: { userId_assetId_platform: { userId, assetId, platform } },
  });
  if (!holding) return;

  const trades = await prisma.trade.findMany({
    where: { userId, assetId, platform },
    orderBy: { tradedAt: "asc" },
  });

  const lots = trades.map((t) => ({
    direction: t.direction as Direction,
    quantity:  Number(t.quantity),
    price:     Number(t.price),
    fees:      Number(t.fees),
    tradedAt:  t.tradedAt,
  }));

  const result = computeCostBasis(lots, holding.valuation as Method);

  await prisma.holding.update({
    where: { userId_assetId_platform: { userId, assetId, platform } },
    data: {
      quantity: Math.max(0, result.currentQty),
      avgCost:  result.avgCost > 0 ? result.avgCost : holding.avgCost,
    },
  });
}
