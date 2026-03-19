import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

// GET /api/budget?month=2025-03
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") ?? currentMonth();

  // All expense categories for the user
  const categories = await prisma.category.findMany({
    where: { userId: session.user.id, direction: "EXPENSE" },
    orderBy: { name: "asc" },
  });

  // Budgets for this month
  const budgets = await prisma.budget.findMany({
    where: { userId: session.user.id, month },
  });
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.categoryId, b]));

  // Spending per category this month
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

  const spending = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId: session.user.id,
      direction: "EXPENSE",
      occurredAt: { gte: monthStart, lte: monthEnd },
    },
    _sum: { amount: true },
  });
  const spendMap = Object.fromEntries(
    spending.map((s) => [s.categoryId, Number(s._sum.amount ?? 0)])
  );

  const result = categories.map((cat) => {
    const budget = budgetMap[cat.id];
    const spent = spendMap[cat.id] ?? 0;
    const limit = budget ? Number(budget.amount) : null;
    const percentage = limit ? (spent / limit) * 100 : null;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      budgetId: budget?.id ?? null,
      limit,
      spent,
      remaining: limit !== null ? limit - spent : null,
      percentage,
      status:
        percentage === null ? "unset"
        : percentage > 100 ? "over"
        : percentage >= 75 ? "warning"
        : "ok",
    };
  });

  return NextResponse.json({ month, items: result });
}

// POST /api/budget  — create or update (upsert)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { categoryId, amount, month } = await request.json();
  if (!categoryId || !amount || !month) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const budget = await prisma.budget.upsert({
    where: { userId_categoryId_month: { userId: session.user.id, categoryId, month } },
    create: { userId: session.user.id, categoryId, amount, month },
    update: { amount },
  });

  return NextResponse.json({ ...budget, amount: Number(budget.amount) }, { status: 201 });
}

// DELETE /api/budget?id=xxx
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

  const existing = await prisma.budget.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.budget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
