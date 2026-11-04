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
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Counter
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Till
          </h1>
          <p className="mt-1 text-ink-soft">
            Scan a barcode, search by name, or tap a product photo.
          </p>
        </div>
        <div className="rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-soft shadow-sm">
          Signed in as <span className="font-semibold text-ink">{session.name}</span>
        </div>
      </div>
      <TillClient initialProducts={products} />
    </AppShell>
  );
}
