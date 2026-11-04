import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ProductsClient } from "@/components/ProductsClient";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const session = await requireSession(["OWNER"]);
  if (!session) redirect("/login");

  const products = await prisma.product.findMany({
    where: { shopId: session.shopId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell user={session}>
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Catalogue
        </p>
        <h1 className="font-display text-4xl font-extrabold tracking-tight">
          Products
        </h1>
        <p className="mt-1 text-ink-soft">
          {session.shopName} — add barcodes before items hit the shelf.
        </p>
      </div>
      <ProductsClient initialProducts={products} />
    </AppShell>
  );
}
