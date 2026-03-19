import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { rows } = await request.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "rows array is required" }, { status: 400 });
  }

  // Validate all category IDs belong to this user
  const categoryIds = [...new Set(rows.map((r: { categoryId: string }) => r.categoryId).filter(Boolean))];
  if (categoryIds.length === 0) {
    return NextResponse.json({ error: "Each row must have a categoryId" }, { status: 400 });
  }

  const validCategories = await prisma.category.findMany({
    where: { id: { in: categoryIds }, userId: session.user.id },
    select: { id: true, direction: true },
  });
  const validCatMap = new Map(validCategories.map((c) => [c.id, c.direction]));

  const data = rows
    .filter((r: { date?: string; amount?: number; categoryId?: string }) =>
      r.amount > 0 && r.date && r.categoryId && validCatMap.has(r.categoryId)
    )
    .map((r: { date: string; amount: number; description: string; categoryId: string; direction: string }) => ({
      userId:      session.user.id,
      categoryId:  r.categoryId,
      direction:   (validCatMap.get(r.categoryId) ?? r.direction) as "INCOME" | "EXPENSE",
      amount:      r.amount,
      description: r.description?.slice(0, 500) || null,
      occurredAt:  new Date(r.date),
    }));

  const { count } = await prisma.transaction.createMany({ data });

  return NextResponse.json({ inserted: count });
}
