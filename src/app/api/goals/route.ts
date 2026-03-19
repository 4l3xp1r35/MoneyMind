import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(goals.map((g) => ({
    ...g,
    targetAmount: Number(g.targetAmount),
    savedAmount:  Number(g.savedAmount),
    deadline:     g.deadline?.toISOString() ?? null,
  })));
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, emoji, targetAmount, savedAmount, deadline, color } = await request.json();
  if (!name || !targetAmount) return NextResponse.json({ error: "name and targetAmount required" }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      userId:       session.user.id,
      name,
      emoji:        emoji || "🎯",
      targetAmount,
      savedAmount:  savedAmount || 0,
      deadline:     deadline ? new Date(deadline) : null,
      color:        color || "#6366f1",
    },
  });

  return NextResponse.json({ ...goal, targetAmount: Number(goal.targetAmount), savedAmount: Number(goal.savedAmount) }, { status: 201 });
}
