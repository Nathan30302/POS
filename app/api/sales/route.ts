import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";

type CartLine = { productId: string; qty: number };
type PayLine = { method: PaymentMethod; amount: number; reference?: string };

export async function GET() {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sales = await prisma.sale.findMany({
    where: { shopId: session.shopId },
    include: {
      cashier: { select: { name: true } },
      lines: { include: { product: { select: { name: true } } } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ sales });
}

export async function POST(request: Request) {
  const session = await requireSession(["OWNER", "CASHIER"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const lines = (body.lines || []) as CartLine[];
    const payments = (body.payments || []) as PayLine[];

    if (!lines.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (!payments.length) {
      return NextResponse.json({ error: "Payment required" }, { status: 400 });
    }

    const productIds = lines.map((l) => l.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, shopId: session.shopId },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400 }
      );
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    let total = 0;

    for (const line of lines) {
      const product = byId.get(line.productId)!;
      const qty = Number(line.qty);
      if (!qty || qty < 1) {
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      }
      if (product.stockQty < qty) {
        return NextResponse.json(
          { error: `Not enough stock for ${product.name}` },
          { status: 400 }
        );
      }
      total += product.price * qty;
    }

    const payTotal = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    if (Math.abs(payTotal - total) > 0.01) {
      return NextResponse.json(
        { error: "Payment amount must match sale total" },
        { status: 400 }
      );
    }

    const sale = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const product = byId.get(line.productId)!;
        const updated = await tx.product.updateMany({
          where: {
            id: product.id,
            stockQty: { gte: line.qty },
          },
          data: { stockQty: { decrement: line.qty } },
        });
        if (updated.count === 0) {
          throw new Error(`Not enough stock for ${product.name}`);
        }
      }

      return tx.sale.create({
        data: {
          shopId: session.shopId,
          cashierId: session.id,
          total,
          lines: {
            create: lines.map((line) => ({
              productId: line.productId,
              qty: line.qty,
              unitPrice: byId.get(line.productId)!.price,
            })),
          },
          payments: {
            create: payments.map((p) => ({
              method: p.method,
              amount: Number(p.amount),
              reference: p.reference?.trim() || null,
            })),
          },
        },
        include: {
          lines: { include: { product: true } },
          payments: true,
          cashier: { select: { name: true } },
        },
      });
    });

    return NextResponse.json({ sale }, { status: 201 });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not complete sale";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
