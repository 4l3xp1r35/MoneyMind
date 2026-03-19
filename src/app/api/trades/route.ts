import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { TradeDirection } from "@prisma/client";
import { syncHolding } from "@/lib/costbasis";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const assetId   = searchParams.get("assetId")   ?? undefined;
    const direction = searchParams.get("direction")  ?? undefined;
    const platform  = searchParams.get("platform")   ?? undefined;
    const from      = searchParams.get("from")       ?? undefined;
    const to        = searchParams.get("to")         ?? undefined;
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit     = 20;

    const where = {
      userId: session.user.id,
      ...(assetId   && { assetId }),
      ...(platform  && { platform }),
      ...(direction && { direction: direction as TradeDirection }),
      ...(from || to
        ? {
            tradedAt: {
              ...(from && { gte: new Date(from) }),
              ...(to   && { lte: new Date(to + "T23:59:59Z") }),
            },
          }
        : {}),
    };

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        include: { asset: true },
        orderBy: { tradedAt: "desc" },
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.trade.count({ where }),
    ]);

    return NextResponse.json({
      trades: trades.map((t) => ({
        id:        t.id,
        assetId:   t.assetId,
        symbol:    t.asset.symbol ?? t.asset.name,
        assetName: t.asset.name,
        assetClass: t.asset.assetClass,
        direction: t.direction,
        quantity:  Number(t.quantity),
        price:     Number(t.price),
        fees:      Number(t.fees),
        platform:  t.platform,
        tradedAt:  t.tradedAt,
        notes:     t.notes,
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error("GET /api/trades:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { assetId, direction, quantity, price, fees, platform, tradedAt, notes } =
      await request.json();

    if (!assetId || !direction || quantity == null || price == null)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const dir = (direction as string).toUpperCase() as TradeDirection;
    if (!Object.values(TradeDirection).includes(dir))
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 });

    // Verify asset belongs to user
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, userId: session.user.id },
    });
    if (!asset)
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const platformKey = ((platform as string) ?? "other").toLowerCase().replace(/\s+/g, "-");

    const trade = await prisma.trade.create({
      data: {
        userId:   session.user.id,
        assetId,
        direction: dir,
        quantity,
        price,
        fees:      fees ?? 0,
        platform:  platformKey,
        tradedAt:  tradedAt ? new Date(tradedAt) : new Date(),
        notes:     notes ?? null,
      },
      include: { asset: true },
    });

    // Sync the related holding
    await syncHolding(prisma, session.user.id, assetId, platformKey);

    return NextResponse.json({
      id:        trade.id,
      assetId:   trade.assetId,
      symbol:    trade.asset.symbol ?? trade.asset.name,
      assetName: trade.asset.name,
      assetClass: trade.asset.assetClass,
      direction: trade.direction,
      quantity:  Number(trade.quantity),
      price:     Number(trade.price),
      fees:      Number(trade.fees),
      platform:  trade.platform,
      tradedAt:  trade.tradedAt,
      notes:     trade.notes,
    }, { status: 201 });
  } catch (err) {
    console.error("POST /api/trades:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
