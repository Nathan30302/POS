import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TillClient } from "@/components/TillClient";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TillPage() {
  const session = await requireSession(["OWNER", "CASHIER"]);
  if (!session) redirect("/login");

  const products = await prisma.product.findMany({
    where: { shopId: session.shopId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <AppShell user={session}>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Till</h1>
        <p className="mt-1 text-ink-soft">
          Scan a barcode, search by name, or tap a product photo to sell.
        </p>
      </div>
      <TillClient initialProducts={products} />
    </AppShell>
  );
}
