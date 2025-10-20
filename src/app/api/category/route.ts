import { PrismaClient } from "@prisma/client";
import { NextRequest,NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const categories = await prisma.category.findMany();
  return NextResponse.json(categories);
}

export async function POST(request: NextRequest) {
    const { userId, name, direction } = await request.json();
    if (!userId || !name || !direction) {
        return NextResponse.json(
            { error: "Missing required fields" }, 
            { status: 400 });
    }

    const newCategory = await prisma.category.create({
        data: { userId, name, direction }
    });
    return NextResponse.json(newCategory, { status: 201 });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("id");
    if (!categoryId) {
        return NextResponse.json(
            { error: "Category ID is required" }, 
            { status: 400 });
    }

    const deletedCategory = await prisma.category.delete({
        where: { id: categoryId }
    });
    return NextResponse.json(deletedCategory);
}