import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const platforms = await prisma.platform.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, name: true, label: true, isEnabled: true, extra: true, createdAt: true,
      // Never expose raw keys to the client — just signal that they exist
      apiKey: false, apiSecret: false,
    },
  });

  return NextResponse.json(
    platforms.map((p) => ({ ...p, hasSecret: true }))
  );
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, label, apiKey, apiSecret, extra } = await request.json();
  if (!name || !label || !apiKey) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const platform = await prisma.platform.create({
    data: {
      userId: session.user.id,
      name,
      label,
      apiKey: encrypt(apiKey),
      apiSecret: apiSecret ? encrypt(apiSecret) : null,
      extra: extra ?? null,
    },
    select: { id: true, name: true, label: true, isEnabled: true, extra: true, createdAt: true },
  });

  return NextResponse.json(platform, { status: 201 });
}
