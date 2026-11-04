"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ScanBarcode, ShieldCheck, Smartphone } from "lucide-react";

const demos = [
  { label: "Owner", email: "owner@pos.local", password: "demo1234" },
  { label: "Cashier", email: "cashier@pos.local", password: "demo1234" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("cashier@pos.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }
      router.push(data.redirect);
      router.refresh();
    } catch {
      setError("Could not reach the server");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Sample demo
          </div>
          <div>
            <h1 className="max-w-md text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
              POS
            </h1>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-soft">
              A shop-only till for stationery. Scan products, take cash or
              mobile money, and let the owner see sales and stock — no tax
              gateway, just the business.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: ScanBarcode,
                title: "Scan & sell",
                text: "Barcode or search, fast cart",
              },
              {
                icon: Smartphone,
                title: "Cash + MoMo",
                text: "Airtel, MTN, Zamtel recorded",
              },
              {
                icon: ShieldCheck,
                title: "Owner view",
                text: "Today’s totals & low stock",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-line bg-card/70 p-4"
              >
                <item.icon className="mb-3 h-5 w-5 text-accent" />
                <p className="font-medium text-ink">{item.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-line bg-card p-6 shadow-[0_30px_80px_-40px_rgba(28,25,23,0.45)] sm:p-8">
          <h2 className="text-2xl font-semibold text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Use a demo account to walk the client through a sale.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {demos.map((demo) => (
              <button
                key={demo.email}
                type="button"
                onClick={() => {
                  setEmail(demo.email);
                  setPassword(demo.password);
                  setError("");
                }}
                className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
              >
                Fill {demo.label}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none ring-accent/30 transition focus:ring-4"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-ink">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none ring-accent/30 transition focus:ring-4"
                required
              />
            </label>

            {error ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3.5 font-medium text-white transition hover:bg-accent-deep disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Open POS"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="mt-6 rounded-2xl bg-paper-deep/70 p-4 text-sm text-ink-soft">
            <p className="font-medium text-ink">Demo logins</p>
            <p className="mt-1">owner@pos.local / demo1234</p>
            <p>cashier@pos.local / demo1234</p>
          </div>
        </section>
      </div>
    </div>
  );
}
