import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const types = await prisma.type.findMany();
  return NextResponse.json(types);
}

export async function POST(request: NextRequest) {
  const { name, appliesTo, userId } = await request.json();
  if (!name || !appliesTo || !userId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const newType = await prisma.type.create({
    data: { name, appliesTo, userId },
  });
  return NextResponse.json(newType, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const typeId = searchParams.get("id");
  if (!typeId) {
    return NextResponse.json(
      { error: "Type ID is required" },
      { status: 400 }
    );
  }

  const deletedType = await prisma.type.delete({
    where: { id: typeId },
  });
  return NextResponse.json(deletedType);
}