import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  const session = await requireSession(["OWNER"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.product.findFirst({
      where: { id, shopId: session.shopId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const product = await prisma.product.update({
      where: { id },
      data: {
        name: String(body.name || existing.name).trim(),
        barcode: String(body.barcode || existing.barcode).trim(),
        sku: String(body.sku || existing.sku).trim(),
        category: String(body.category || existing.category).trim(),
        price: Number(body.price ?? existing.price),
        stockQty: Number(body.stockQty ?? existing.stockQty),
        reorderLevel: Number(body.reorderLevel ?? existing.reorderLevel),
        imageUrl:
          body.imageUrl === undefined
            ? existing.imageUrl
            : body.imageUrl
              ? String(body.imageUrl)
              : null,
      },
    });

    return NextResponse.json({ product });
  } catch (error: unknown) {
    const message =
      error && typeof error === "object" && "code" in error && error.code === "P2002"
        ? "Barcode or SKU already exists"
        : "Could not update product";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
