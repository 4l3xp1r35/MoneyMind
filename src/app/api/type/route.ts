import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const types = await prisma.type.findMany({
    where: { userId: session.user.id },
    orderBy: [{ appliesTo: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, appliesTo } = await request.json();
  if (!name || !appliesTo) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const type = await prisma.type.create({
      data: { userId: session.user.id, name: name.trim(), appliesTo },
    });
    return NextResponse.json(type, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Type already exists" }, { status: 409 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, name, appliesTo } = await request.json();
  if (!id || !name) return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

  const existing = await prisma.type.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.type.update({
    where: { id },
    data: { name: name.trim(), ...(appliesTo ? { appliesTo } : {}) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const existing = await prisma.type.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.type.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
