import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { AssetClass } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id },
    include: { asset: true },
    orderBy: [{ asset: { assetClass: "asc" } }, { openedAt: "asc" }],
  });

  return NextResponse.json(
    holdings.map((h) => ({
      id:          h.id,
      assetId:     h.assetId,
      symbol:      h.asset.symbol ?? h.asset.name,
      name:        h.asset.name,
      assetClass:  h.asset.assetClass,
      currency:    h.asset.currency,
      quantity:    Number(h.quantity),
      avgCost:     Number(h.avgCost),
      platform:    h.platform,
      priceSymbol: h.priceSymbol ?? null,
      leverage:    h.leverage ?? null,
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { symbol, name, assetClass, quantity, avgCost, platform, priceSymbol, leverage } = await request.json();

  if (!symbol || !assetClass || quantity == null || avgCost == null)
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const cls = assetClass.toUpperCase() as AssetClass;
  if (!Object.values(AssetClass).includes(cls))
    return NextResponse.json({ error: "Invalid assetClass" }, { status: 400 });

  const platformKey = (platform ?? "other").toLowerCase().replace(/\s+/g, "-");

  // Upsert asset by (userId, symbol, assetClass)
  const asset = await prisma.asset.upsert({
    where: {
      userId_symbol_assetClass: {
        userId:     session.user.id,
        symbol:     symbol.toUpperCase(),
        assetClass: cls,
      },
    },
    create: {
      userId:     session.user.id,
      symbol:     symbol.toUpperCase(),
      name:       name || symbol.toUpperCase(),
      assetClass: cls,
      currency:   "USD",
    },
    update: { name: name || symbol.toUpperCase() },
  });

  // Upsert holding by (userId, assetId, platform)
  const holding = await prisma.holding.upsert({
    where: {
      userId_assetId_platform: {
        userId:   session.user.id,
        assetId:  asset.id,
        platform: platformKey,
      },
    },
    create: {
      userId:      session.user.id,
      assetId:     asset.id,
      quantity,
      avgCost,
      platform:    platformKey,
      priceSymbol: priceSymbol?.trim().toUpperCase() || null,
      leverage:    leverage ? Number(leverage) : null,
    },
    update: {
      quantity,
      avgCost,
      priceSymbol: priceSymbol?.trim().toUpperCase() || null,
      leverage:    leverage ? Number(leverage) : null,
    },
    include: { asset: true },
  });

  return NextResponse.json({
    id:         holding.id,
    symbol:     holding.asset.symbol ?? holding.asset.name,
    name:       holding.asset.name,
    assetClass: holding.asset.assetClass,
    currency:   holding.asset.currency,
    quantity:   Number(holding.quantity),
    avgCost:    Number(holding.avgCost),
    platform:    holding.platform,
    priceSymbol: holding.priceSymbol ?? null,
    leverage:    holding.leverage ?? null,
  });
}
