import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

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
    const { symbol, name, assetClass, quantity, avgCost, platform, priceSymbol, leverage } = body;

    const holding = await prisma.holding.findUnique({
      where: { id },
      include: { asset: true },
    });
    if (!holding || holding.userId !== session.user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Update asset fields if they changed
    const assetUpdate: Record<string, string> = {};
    if (symbol   && symbol.toUpperCase()   !== holding.asset.symbol)     assetUpdate.symbol     = symbol.toUpperCase();
    if (name     && name                   !== holding.asset.name)       assetUpdate.name       = name;
    if (assetClass && assetClass.toUpperCase() !== holding.asset.assetClass) assetUpdate.assetClass = assetClass.toUpperCase();

    if (Object.keys(assetUpdate).length > 0) {
      await prisma.asset.update({
        where: { id: holding.assetId },
        data: assetUpdate,
      });
    }

    // Update holding fields
    const updated = await prisma.holding.update({
      where: { id },
      data: {
        ...(quantity != null && { quantity }),
        ...(avgCost  != null && { avgCost }),
        ...(platform != null && { platform: (platform as string).toLowerCase().replace(/\s+/g, "-") }),
        priceSymbol: priceSymbol ? (priceSymbol as string).trim().toUpperCase() : null,
        leverage: leverage != null ? Number(leverage) : null,
      },
      include: { asset: true },
    });

    return NextResponse.json({
      id:          updated.id,
      symbol:      updated.asset.symbol ?? updated.asset.name,
      name:        updated.asset.name,
      assetClass:  updated.asset.assetClass,
      currency:    updated.asset.currency,
      quantity:    Number(updated.quantity),
      avgCost:     Number(updated.avgCost),
      platform:    updated.platform,
      priceSymbol: updated.priceSymbol ?? null,
      leverage:    updated.leverage ?? null,
    });
  } catch (err) {
    console.error("PUT /api/holdings/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
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
    const holding = await prisma.holding.findUnique({ where: { id } });
    if (!holding || holding.userId !== session.user.id)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.holding.delete({ where: { id } });

    // Clean up orphaned asset
    const remaining = await prisma.holding.count({
      where: { assetId: holding.assetId },
    });
    if (remaining === 0) {
      await prisma.asset.delete({ where: { id: holding.assetId } });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/holdings/[id] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
