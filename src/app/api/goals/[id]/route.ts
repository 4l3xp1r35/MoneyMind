import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, emoji, targetAmount, savedAmount, deadline, color } = await request.json();

  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...(name         != null && { name }),
      ...(emoji        != null && { emoji }),
      ...(targetAmount != null && { targetAmount }),
      ...(savedAmount  != null && { savedAmount }),
      ...(color        != null && { color }),
      deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
    },
  });

  return NextResponse.json({ ...updated, targetAmount: Number(updated.targetAmount), savedAmount: Number(updated.savedAmount) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.userId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.goal.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
