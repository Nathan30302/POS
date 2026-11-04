import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  Banknote,
  Package,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { requireSession } from "@/lib/auth";
import { formatZMW, todayStart } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await requireSession(["OWNER"]);
  if (!session) redirect("/login");

  const start = todayStart();

  const [todaySales, lowStock, recentSales, productCount] = await Promise.all([
    prisma.sale.findMany({
      where: { shopId: session.shopId, createdAt: { gte: start } },
      include: { payments: true },
    }),
    prisma.product.findMany({
      where: {
        shopId: session.shopId,
      },
      orderBy: { stockQty: "asc" },
    }),
    prisma.sale.findMany({
      where: { shopId: session.shopId },
      include: {
        cashier: { select: { name: true } },
        payments: true,
        lines: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.product.count({ where: { shopId: session.shopId } }),
  ]);

  const low = lowStock.filter((p) => p.stockQty <= p.reorderLevel);

  let cash = 0;
  let airtel = 0;
  let mtn = 0;
  let zamtel = 0;
  let revenue = 0;

  for (const sale of todaySales) {
    revenue += sale.total;
    for (const payment of sale.payments) {
      if (payment.method === "CASH") cash += payment.amount;
      if (payment.method === "AIRTEL") airtel += payment.amount;
      if (payment.method === "MTN") mtn += payment.amount;
      if (payment.method === "ZAMTEL") zamtel += payment.amount;
    }
  }

  const momo = airtel + mtn + zamtel;

  return (
    <AppShell user={session}>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Owner view
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">
            Today at a glance
          </h1>
          <p className="mt-1 text-ink-soft">
            {session.shopName} — cash, mobile money, and stock health.
          </p>
        </div>
        <Link
          href="/till"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-black"
        >
          <ShoppingCart className="h-4 w-4" />
          Open till
        </Link>
      </div>

      <div className="mb-6 overflow-hidden rounded-[2rem] border border-line bg-ink p-6 text-white shadow-[var(--shadow)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm text-white/60">Revenue today</p>
            <p className="mt-2 font-display text-5xl font-extrabold tracking-tight text-lime">
              {formatZMW(revenue)}
            </p>
            <p className="mt-2 text-sm text-white/55">
              {todaySales.length} sales · {productCount} products in catalogue
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Cash", value: formatZMW(cash) },
              { label: "Airtel", value: formatZMW(airtel) },
              { label: "MTN", value: formatZMW(mtn) },
              { label: "Zamtel", value: formatZMW(zamtel) },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-xs uppercase tracking-[0.14em] text-white/45">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Today’s sales",
            value: String(todaySales.length),
            sub: "Completed checkouts",
            icon: ShoppingCart,
          },
          {
            label: "Cash in drawer",
            value: formatZMW(cash),
            sub: "Cash tenders only",
            icon: Banknote,
          },
          {
            label: "Mobile money",
            value: formatZMW(momo),
            sub: "Airtel + MTN + Zamtel",
            icon: Smartphone,
          },
          {
            label: "Low stock items",
            value: String(low.length),
            sub: "Need reorder attention",
            icon: AlertTriangle,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.75rem] border border-line bg-card p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-ink-soft">{card.label}</p>
              <card.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="font-display text-2xl font-extrabold tracking-tight">
              {card.value}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink-soft">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[1.75rem] border border-line bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <h2 className="font-display text-lg font-bold">Low stock</h2>
          </div>
          {low.length === 0 ? (
            <p className="text-sm text-ink-soft">All products are healthy.</p>
          ) : (
            <div className="space-y-3">
              {low.slice(0, 8).map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between rounded-2xl bg-mist px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium">{product.name}</p>
                    <p className="text-xs text-ink-soft">
                      Reorder at {product.reorderLevel}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    {product.stockQty} left
                  </span>
                </div>
              ))}
            </div>
          )}
          <Link
            href="/products"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-deep"
          >
            <Package className="h-4 w-4" />
            Manage products
          </Link>
        </section>

        <section className="rounded-[1.75rem] border border-line bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-bold">Recent sales</h2>
          <div className="space-y-3">
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-2xl border border-line px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    #{sale.id.slice(-8).toUpperCase()} · {sale.cashier.name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {sale.lines.reduce((n, l) => n + l.qty, 0)} items ·{" "}
                    {sale.payments.map((p) => p.method).join(", ")} ·{" "}
                    {new Date(sale.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="font-semibold">{formatZMW(sale.total)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
