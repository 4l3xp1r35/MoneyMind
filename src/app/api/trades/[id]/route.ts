import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { TradeDirection } from "@prisma/client";
import { syncHolding } from "@/lib/costbasis";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { direction, quantity, price, fees, platform, tradedAt, notes } = body;

    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade || trade.userId !== session.user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const platformKey = platform
      ? (platform as string).toLowerCase().replace(/\s+/g, "-")
      : trade.platform;

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        ...(direction && { direction: (direction as string).toUpperCase() as TradeDirection }),
        ...(quantity  != null && { quantity }),
        ...(price     != null && { price }),
        ...(fees      != null && { fees }),
        ...(tradedAt  && { tradedAt: new Date(tradedAt) }),
        ...(notes     !== undefined && { notes }),
        platform: platformKey,
      },
      include: { asset: true },
    });

    // Sync both old and new platform holdings
    await syncHolding(prisma, session.user.id, trade.assetId, trade.platform);
    if (platformKey !== trade.platform) {
      await syncHolding(prisma, session.user.id, trade.assetId, platformKey);
    }

    return NextResponse.json({
      id:        updated.id,
      assetId:   updated.assetId,
      symbol:    updated.asset.symbol ?? updated.asset.name,
      assetName: updated.asset.name,
      assetClass: updated.asset.assetClass,
      direction: updated.direction,
      quantity:  Number(updated.quantity),
      price:     Number(updated.price),
      fees:      Number(updated.fees),
      platform:  updated.platform,
      tradedAt:  updated.tradedAt,
      notes:     updated.notes,
    });
  } catch (err) {
    console.error("PUT /api/trades/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade || trade.userId !== session.user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.trade.delete({ where: { id } });
    await syncHolding(prisma, session.user.id, trade.assetId, trade.platform);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/trades/[id]:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
