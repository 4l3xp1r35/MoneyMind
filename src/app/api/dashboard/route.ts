import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function monthLabel(date: Date) {
  return date.toLocaleString("default", { month: "short", year: "2-digit" });
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({
      currentMonth: { income: 0, expenses: 0, savings: 0, savingsRate: 0 },
      monthlyChart: [],
      portfolioChart: [],
      netWorthChart: [],
      topCategories: [],
      insights: [],
      recentTransactions: [],
    });
  }

  const userId = session.user.id;

  // Optional ?month=YYYY-MM param (for report page)
  const monthParam = request.nextUrl.searchParams.get("month");
  const now = monthParam
    ? new Date(Number(monthParam.split("-")[0]), Number(monthParam.split("-")[1]) - 1, 1)
    : new Date();

  // --- Current month stats ---
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId, direction: "INCOME", occurredAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, direction: "EXPENSE", occurredAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
      _sum: { amount: true },
    }),
  ]);

  const monthIncome   = Number(incomeAgg._sum.amount   ?? 0);
  const monthExpenses = Number(expenseAgg._sum.amount  ?? 0);
  const savings       = monthIncome - monthExpenses;
  const savingsRate   = monthIncome > 0 ? (savings / monthIncome) * 100 : 0;

  // --- Monthly chart: last 12 months ---
  const months: { month: string; income: number; expenses: number; savings: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const [inc, exp] = await Promise.all([
      prisma.transaction.aggregate({
        where: { userId, direction: "INCOME",  occurredAt: { gte: startOfMonth(d), lte: endOfMonth(d) } },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId, direction: "EXPENSE", occurredAt: { gte: startOfMonth(d), lte: endOfMonth(d) } },
        _sum: { amount: true },
      }),
    ]);
    const inc_ = Number(inc._sum.amount ?? 0);
    const exp_ = Number(exp._sum.amount ?? 0);
    months.push({ month: monthLabel(d), income: inc_, expenses: exp_, savings: inc_ - exp_ });
  }

  // --- Portfolio chart: cumulative invested from trades (last 12 months) ---
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const recentTrades = await prisma.trade.findMany({
    where: { userId, tradedAt: { gte: twelveMonthsAgo } },
    select: { direction: true, quantity: true, price: true, fees: true, tradedAt: true },
    orderBy: { tradedAt: "asc" },
  });

  const portfolioByMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    portfolioByMonth[monthLabel(d)] = 0;
  }
  let cumTrades = 0;
  for (const t of recentTrades) {
    const label = monthLabel(t.tradedAt);
    const delta = t.direction === "BUY"
      ? Number(t.quantity) * Number(t.price) + Number(t.fees)
      : -(Number(t.quantity) * Number(t.price) - Number(t.fees));
    cumTrades += delta;
    if (label in portfolioByMonth) portfolioByMonth[label] = cumTrades;
  }
  let lastPortfolio = 0;
  const portfolioChart = Object.entries(portfolioByMonth).map(([month, val]) => {
    lastPortfolio = val > 0 ? val : lastPortfolio;
    return { month, invested: val > 0 ? val : lastPortfolio };
  });

  // --- Net worth timeline: cumulative (income - expenses) + cumulative invested ---
  // Fetch all transactions and trades from the beginning to build running totals
  const [allTxs, allTrades] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, occurredAt: { lte: endOfMonth(now) } },
      select: { direction: true, amount: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
    prisma.trade.findMany({
      where: { userId, tradedAt: { lte: endOfMonth(now) } },
      select: { direction: true, quantity: true, price: true, fees: true, tradedAt: true },
      orderBy: { tradedAt: "asc" },
    }),
  ]);

  // Build per-month cumulative snapshot
  const netWorthByMonth: Record<string, number> = {};
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    netWorthByMonth[monthLabel(d)] = 0;
  }

  let runningCash = 0;
  let runningInvested = 0;
  let txIdx = 0;
  let trIdx = 0;

  for (let i = 11; i >= 0; i--) {
    const monthEnd = endOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
    // Consume transactions up to this month end
    while (txIdx < allTxs.length && allTxs[txIdx].occurredAt <= monthEnd) {
      const tx = allTxs[txIdx++];
      runningCash += tx.direction === "INCOME" ? Number(tx.amount) : -Number(tx.amount);
    }
    // Consume trades up to this month end
    while (trIdx < allTrades.length && allTrades[trIdx].tradedAt <= monthEnd) {
      const t = allTrades[trIdx++];
      runningInvested += t.direction === "BUY"
        ? Number(t.quantity) * Number(t.price) + Number(t.fees)
        : -(Number(t.quantity) * Number(t.price) - Number(t.fees));
    }
    const label = monthLabel(new Date(now.getFullYear(), now.getMonth() - i, 1));
    netWorthByMonth[label] = runningCash + runningInvested;
  }

  const netWorthChart = Object.entries(netWorthByMonth).map(([month, netWorth]) => ({
    month,
    netWorth: Math.max(0, netWorth), // floor at 0 for display clarity
  }));

  // --- Top expense categories this month ---
  const categoryTotals = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, direction: "EXPENSE", occurredAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: 6,
  });

  const categoryIds = categoryTotals.map((c) => c.categoryId);
  const categories  = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c.name]));

  const totalExpenses = categoryTotals.reduce((s, c) => s + Number(c._sum.amount ?? 0), 0);
  const topCategories = categoryTotals.map((c) => ({
    name:       catMap[c.categoryId] ?? "Unknown",
    amount:     Number(c._sum.amount ?? 0),
    percentage: totalExpenses > 0 ? Math.round((Number(c._sum.amount ?? 0) / totalExpenses) * 100) : 0,
  }));

  // --- Spending insights: current vs previous month per category ---
  const prevMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const prevMonthEnd   = endOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  const prevTotals = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { userId, direction: "EXPENSE", occurredAt: { gte: prevMonthStart, lte: prevMonthEnd } },
    _sum: { amount: true },
  });
  const prevMap = Object.fromEntries(prevTotals.map((p) => [p.categoryId, Number(p._sum.amount ?? 0)]));

  const insights = categoryTotals
    .map((c) => {
      const current  = Number(c._sum.amount ?? 0);
      const previous = prevMap[c.categoryId] ?? 0;
      if (previous < 5 || current < 5) return null; // skip noise
      const delta = ((current - previous) / previous) * 100;
      if (Math.abs(delta) < 10) return null; // skip small changes
      return { category: catMap[c.categoryId] ?? "Unknown", current, previous, delta: Math.round(delta) };
    })
    .filter(Boolean)
    .sort((a, b) => Math.abs(b!.delta) - Math.abs(a!.delta))
    .slice(0, 4);

  // --- Recent transactions ---
  const txs = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 8,
    include: { category: { select: { name: true } } },
  });

  const recentTransactions = txs.map((t) => ({
    id:          t.id,
    description: t.description ?? t.category.name,
    amount:      Number(t.amount),
    direction:   t.direction,
    category:    t.category.name,
    occurredAt:  t.occurredAt.toISOString(),
  }));

  return NextResponse.json({
    currentMonth: { income: monthIncome, expenses: monthExpenses, savings, savingsRate },
    monthlyChart: months,
    portfolioChart,
    netWorthChart,
    topCategories,
    insights,
    recentTransactions,
  });
}
