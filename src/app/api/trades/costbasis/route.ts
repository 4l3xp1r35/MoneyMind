import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { computeCostBasis, type Method, type TradeLot } from "@/lib/costbasis";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assetIdFilter = searchParams.get("assetId") ?? undefined;

    // Fetch all trades for this user, grouped by assetId
    const trades = await prisma.trade.findMany({
      where: {
        userId: session.user.id,
        ...(assetIdFilter && { assetId: assetIdFilter }),
      },
      include: { asset: true },
      orderBy: { tradedAt: "asc" },
    });

    // Fetch holdings to get valuation methods
    const holdings = await prisma.holding.findMany({
      where: { userId: session.user.id },
    });
    const holdingMap = new Map(holdings.map((h) => [h.assetId, h]));

    // Group trades by assetId
    const byAsset = new Map<string, typeof trades>();
    for (const t of trades) {
      if (!byAsset.has(t.assetId)) byAsset.set(t.assetId, []);
      byAsset.get(t.assetId)!.push(t);
    }

    const results = [];
    for (const [assetId, assetTrades] of byAsset.entries()) {
      const asset   = assetTrades[0].asset;
      const holding = holdingMap.get(assetId);
      const method  = (holding?.valuation ?? "AVG") as Method;

      const lots: TradeLot[] = assetTrades.map((t) => ({
        direction: t.direction as "BUY" | "SELL",
        quantity:  Number(t.quantity),
        price:     Number(t.price),
        fees:      Number(t.fees),
        tradedAt:  t.tradedAt,
      }));

      const cb = computeCostBasis(lots, method);

      results.push({
        assetId,
        symbol:      asset.symbol ?? asset.name,
        name:        asset.name,
        assetClass:  asset.assetClass,
        method,
        currentQty:  cb.currentQty,
        avgCost:     cb.avgCost,
        realizedPnL: cb.realizedPnL,
        totalFees:   cb.totalFees,
        totalBought: cb.totalBought,
        totalSold:   cb.totalSold,
      });
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("GET /api/trades/costbasis:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
