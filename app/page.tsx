import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ScanLine, Wallet, ChartNoAxesCombined } from "lucide-react";

const gallery = [
  "/products/pen-black.jpg",
  "/products/exercise-book.jpg",
  "/products/a4-paper.jpg",
  "/products/math-set.jpg",
  "/products/crayons.jpg",
  "/products/stapler.jpg",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink text-white">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="font-display text-2xl font-extrabold tracking-tight">
            POS
          </div>
          <Link
            href="/login"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur transition hover:bg-white hover:text-ink"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="relative min-h-[100svh]">
        <Image
          src="/hero-counter.jpg"
          alt="Stationery shop counter"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/78 to-ink/25" />
        <div className="hero-grid absolute inset-0 opacity-40" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-16 pt-28 sm:px-8 sm:pb-20">
          <div className="max-w-3xl animate-rise">
            <p className="mb-5 inline-flex rounded-full border border-lime/40 bg-lime/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-lime">
              Shop demo
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              POS
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/78 sm:text-xl">
              The counter your staff can actually use — scan, sell, take cash or
              mobile money, and know what left the shelf.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 animate-rise-delay">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3.5 text-sm font-bold text-ink transition hover:brightness-95"
              >
                Open the live demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-sm text-white/55">
                Owner & cashier accounts ready
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-mist px-5 py-20 text-ink sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 max-w-2xl animate-rise">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Built for the till, not for tax software.
            </h2>
            <p className="mt-4 text-lg text-ink-soft">
              A clean walkthrough for a stationery shop: sell fast, record Airtel
              / MTN / Zamtel, and give the owner a clear picture of today.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ScanLine,
                title: "Scan & sell",
                text: "Barcode, search, or tap a product photo. Cart updates instantly.",
              },
              {
                icon: Wallet,
                title: "Cash + MoMo",
                text: "Record how the customer paid — cash drawer and wallets stay honest.",
              },
              {
                icon: ChartNoAxesCombined,
                title: "Owner clarity",
                text: "Today’s revenue, payment split, low stock, and recent sales.",
              },
            ].map((item, i) => (
              <div
                key={item.title}
                className={`rounded-[1.75rem] border border-line bg-card p-6 shadow-[var(--shadow)] ${
                  i === 1 ? "animate-rise-delay" : i === 2 ? "animate-rise-delay-2" : "animate-rise"
                }`}
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Stationery that looks real on the till.
            </h2>
            <p className="mt-4 max-w-md text-white/65">
              Twenty seeded products with photos, barcodes, and stock levels —
              including items already running low so the owner dashboard feels
              alive.
            </p>
            <Link
              href="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-lime"
            >
              Try as cashier
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {gallery.map((src, idx) => (
              <div
                key={src}
                className={`relative aspect-square overflow-hidden rounded-[1.4rem] ${
                  idx % 2 === 0 ? "animate-float" : ""
                }`}
                style={idx % 2 === 0 ? { animationDelay: `${idx * 0.35}s` } : undefined}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="180px"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-accent px-5 py-20 text-white sm:px-8">
        <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 rounded-full bg-lime/30 blur-3xl" />
        <div className="relative mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Ready to walk the client through a sale?
            </h2>
            <p className="mt-4 text-white/75">
              Sign in as cashier, complete a payment, then switch to owner and
              show today’s numbers.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-bold text-white transition hover:bg-black"
          >
            Enter the demo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-ink px-5 py-8 text-sm text-white/45 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-lg font-bold text-white">POS</span>
          <span>Internal shop sample · Cash & mobile money · No tax gateway</span>
        </div>
      </footer>
    </div>
  );
}
