import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

function nextDate(from: Date, recurrence: string): Date {
  const d = new Date(from);
  if (recurrence === "WEEKLY") d.setDate(d.getDate() + 7);
  else if (recurrence === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (recurrence === "YEARLY") d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Find all recurring transactions due for this user
  const due = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      recurrence: { not: null },
      nextOccurrence: { lte: now },
    },
  });

  if (due.length === 0) {
    return NextResponse.json({ generated: 0 });
  }

  let generated = 0;

  for (const template of due) {
    if (!template.recurrence || !template.nextOccurrence) continue;

    // Create the new transaction for this occurrence
    await prisma.transaction.create({
      data: {
        userId: template.userId,
        amount: template.amount,
        direction: template.direction,
        categoryId: template.categoryId,
        typeId: template.typeId,
        description: template.description,
        occurredAt: template.nextOccurrence,
        parentId: template.id,
        // not recurring itself — it's a generated copy
      },
    });

    // Advance nextOccurrence on the template
    await prisma.transaction.update({
      where: { id: template.id },
      data: { nextOccurrence: nextDate(template.nextOccurrence, template.recurrence) },
    });

    generated++;
  }

  return NextResponse.json({ generated });
}
