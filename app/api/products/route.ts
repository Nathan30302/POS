import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  const products = await prisma.product.findMany({
    where: {
      shopId: session.shopId,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { sku: { contains: q } },
              { category: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ products });
}

export async function POST(request: Request) {
  const session = await requireSession(["OWNER"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const barcode = String(body.barcode || "").trim();
    const sku = String(body.sku || "").trim();
    const category = String(body.category || "General").trim();
    const price = Number(body.price);
    const stockQty = Number(body.stockQty);
    const reorderLevel = Number(body.reorderLevel ?? 10);
    const imageUrl = body.imageUrl ? String(body.imageUrl) : null;

    if (!name || !barcode || !sku || Number.isNaN(price) || Number.isNaN(stockQty)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        shopId: session.shopId,
        name,
        barcode,
        sku,
        category,
        price,
        stockQty,
        reorderLevel,
        imageUrl,
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "code" in error && error.code === "P2002"
        ? "Barcode or SKU already exists"
        : "Could not create product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
