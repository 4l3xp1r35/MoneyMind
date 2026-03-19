import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function calcNextOccurrence(from: Date, recurrence: string): Date {
  const d = new Date(from);
  if (recurrence === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (recurrence === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (recurrence === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const direction = searchParams.get("direction"); // INCOME | EXPENSE | null
  const categoryId = searchParams.get("categoryId");
  const search = searchParams.get("search");
  const month = searchParams.get("month"); // "2025-03" format
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  // Build date filter from month param
  let dateFilter: { gte?: Date; lte?: Date } | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dateFilter = {
      gte: new Date(y, m - 1, 1),
      lte: new Date(y, m, 0, 23, 59, 59, 999),
    };
  }

  const where = {
    userId: session.user.id,
    ...(direction ? { direction: direction as "INCOME" | "EXPENSE" } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(search
      ? { description: { contains: search, mode: "insensitive" as const } }
      : {}),
    ...(dateFilter ? { occurredAt: dateFilter } : {}),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { occurredAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        category: { select: { id: true, name: true } },
        type: { select: { id: true, name: true } },
        asset: { select: { id: true, name: true, symbol: true } },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  // Summary totals for the current filter
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { ...where, direction: "INCOME" },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, direction: "EXPENSE" },
      _sum: { amount: true },
    }),
  ]);

  return NextResponse.json({
    transactions: transactions.map((t) => ({
      ...t,
      amount: Number(t.amount),
      units: t.units ? Number(t.units) : null,
      unitPrice: t.unitPrice ? Number(t.unitPrice) : null,
      fees: t.fees ? Number(t.fees) : null,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    summary: {
      income: Number(incomeAgg._sum.amount ?? 0),
      expenses: Number(expenseAgg._sum.amount ?? 0),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { amount, direction, categoryId, typeId, description, occurredAt, recurrence } = body;

  if (!amount || !direction || !categoryId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const startDate = occurredAt ? new Date(occurredAt) : new Date();
  const nextOccurrence = recurrence ? calcNextOccurrence(startDate, recurrence) : null;

  const transaction = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      amount,
      direction,
      categoryId,
      typeId: typeId || null,
      description: description || null,
      occurredAt: startDate,
      recurrence: recurrence || null,
      nextOccurrence,
    },
    include: {
      category: { select: { id: true, name: true } },
      type: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(
    {
      ...transaction,
      amount: Number(transaction.amount),
    },
    { status: 201 }
  );
}
