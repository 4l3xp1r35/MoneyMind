import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { label, apiKey, apiSecret, extra, isEnabled } = await request.json();

  const existing = await prisma.platform.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.platform.update({
    where: { id },
    data: {
      ...(label !== undefined && { label }),
      ...(apiKey && { apiKey: encrypt(apiKey) }),
      ...(apiSecret && { apiSecret: encrypt(apiSecret) }),
      ...(extra !== undefined && { extra }),
      ...(isEnabled !== undefined && { isEnabled }),
    },
    select: { id: true, name: true, label: true, isEnabled: true, extra: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.platform.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.platform.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
