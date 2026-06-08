import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function nextDate(from: Date, recurrence: string): Date {
  const d = new Date(from);
  if (recurrence === "WEEKLY")       d.setDate(d.getDate() + 7);
  else if (recurrence === "MONTHLY") d.setMonth(d.getMonth() + 1);
  else if (recurrence === "YEARLY")  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function processRecurring(): Promise<number> {
  const now = new Date();

  // Process ALL users — this runs as a system-level background job
  const due = await prisma.transaction.findMany({
    where: {
      recurrence: { not: null },
      nextOccurrence: { lte: now },
    },
  });

  if (due.length === 0) return 0;

  let generated = 0;

  for (const template of due) {
    if (!template.recurrence || !template.nextOccurrence) continue;

    await prisma.transaction.create({
      data: {
        userId:      template.userId,
        amount:      template.amount,
        direction:   template.direction,
        categoryId:  template.categoryId,
        typeId:      template.typeId,
        description: template.description,
        occurredAt:  template.nextOccurrence,
        parentId:    template.id,
      },
    });

    await prisma.transaction.update({
      where: { id: template.id },
      data:  { nextOccurrence: nextDate(template.nextOccurrence, template.recurrence) },
    });

    generated++;
  }

  console.log(`[recurring] processed ${generated} transactions for ${new Date().toISOString()}`);
  return generated;
}
