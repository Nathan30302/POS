"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Eye,
  EyeOff,
  LayoutDashboard,
  LoaderCircle,
  ShoppingCart,
} from "lucide-react";

const demos = [
  {
    label: "Owner",
    email: "owner@pos.local",
    password: "demo1234",
    hint: "Totals · stock · products",
    icon: LayoutDashboard,
  },
  {
    label: "Cashier",
    email: "cashier@pos.local",
    password: "demo1234",
    hint: "Scan · cart · checkout",
    icon: ShoppingCart,
  },
] as const;

const floatingProducts = [
  { src: "/products/pen-black.jpg", className: "left-[8%] top-[18%] w-28 rotate-[-8deg]" },
  { src: "/products/exercise-book.jpg", className: "left-[22%] top-[58%] w-36 rotate-[6deg]" },
  { src: "/products/a4-paper.jpg", className: "left-[42%] top-[22%] w-32 rotate-[4deg]" },
  { src: "/products/math-set.jpg", className: "left-[12%] bottom-[12%] w-28 rotate-[-4deg]" },
  { src: "/products/crayons.jpg", className: "left-[48%] bottom-[18%] w-24 rotate-[10deg]" },
  { src: "/products/stapler.jpg", className: "left-[58%] top-[48%] w-28 rotate-[-6deg]" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("cashier@pos.local");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<(typeof demos)[number]["label"]>("Cashier");

  const active = useMemo(
    () => demos.find((d) => d.label === activeDemo) ?? demos[1],
    [activeDemo]
  );

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
      // Hard navigate so the session cookie is always picked up by middleware
      window.location.assign(data.redirect || "/till");
    } catch {
      setError("Could not reach the server");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-[#070b12] text-white">
      <Image
        src="/login-stage.jpg"
        alt=""
        fill
        priority
        className="object-cover opacity-55"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,245,66,0.16),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(18,122,76,0.28),transparent_30%),linear-gradient(120deg,rgba(7,11,18,0.92)_0%,rgba(7,11,18,0.55)_45%,rgba(7,11,18,0.88)_100%)]" />
      <div className="login-noise absolute inset-0" />

      {/* Floating product stage — desktop */}
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[58%] lg:block">
        {floatingProducts.map((item, i) => (
          <div
            key={item.src}
            className={`animate-drift absolute overflow-hidden rounded-[1.4rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] ${item.className}`}
            style={{ animationDelay: `${i * 0.45}s` }}
          >
            <div className="relative aspect-square w-full">
              <Image src={item.src} alt="" fill className="object-cover" sizes="160px" />
            </div>
          </div>
        ))}
        <div className="animate-pulse-glow absolute left-[30%] top-[40%] h-56 w-56 rounded-full bg-lime/20 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="mb-8 max-w-xl pt-4 lg:mb-0 lg:pt-0">
          <Link
            href="/"
            className="inline-flex items-center gap-3 transition hover:opacity-90"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-lime font-display text-lg font-extrabold text-ink">
              P
            </span>
            <span className="font-display text-2xl font-extrabold tracking-tight">
              POS
            </span>
          </Link>

          <div className="mt-14 hidden animate-rise lg:block">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-lime">
              Counter operating system
            </p>
            <h1 className="font-display text-6xl font-extrabold leading-[0.92] tracking-tight xl:text-7xl">
              Open the
              <span className="block text-lime">till.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-white/60">
              One polished demo for your client walkthrough — scan, take cash or
              mobile money, then show the owner view.
            </p>

            <div className="mt-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {["/products/pen-blue.jpg", "/products/glue.jpg", "/products/ruler.jpg"].map(
                  (src) => (
                    <div
                      key={src}
                      className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-[#070b12]"
                    >
                      <Image src={src} alt="" fill className="object-cover" sizes="48px" />
                    </div>
                  )
                )}
              </div>
              <p className="text-sm text-white/50">
                20 seeded products · live checkout
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[440px] animate-rise-delay self-center lg:self-auto">
          <div className="login-panel rounded-[2rem] p-6 text-ink sm:p-8">
            <div className="mb-7 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-accent">
                  Secure access
                </p>
                <h2 className="mt-2 font-display text-[2rem] font-extrabold leading-none tracking-tight">
                  Sign in
                </h2>
              </div>
              <div className="rounded-full bg-mist px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                Demo
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {demos.map((demo) => {
                const selected = activeDemo === demo.label;
                const Icon = demo.icon;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => {
                      setActiveDemo(demo.label);
                      setEmail(demo.email);
                      setPassword(demo.password);
                      setError("");
                    }}
                    className={`rounded-[1.35rem] border p-3.5 text-left transition ${
                      selected
                        ? "role-card-active border-transparent text-white shadow-lg"
                        : "border-line bg-white/70 text-ink hover:border-accent/40"
                    }`}
                  >
                    <Icon
                      className={`mb-3 h-4 w-4 ${selected ? "text-lime" : "text-accent"}`}
                    />
                    <p className="text-sm font-bold">{demo.label}</p>
                    <p
                      className={`mt-1 text-[11px] leading-snug ${
                        selected ? "text-white/55" : "text-ink-soft"
                      }`}
                    >
                      {demo.hint}
                    </p>
                  </button>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Email
                </span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="username"
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-sm outline-none transition placeholder:text-ink-soft/50 focus:border-accent focus:ring-4 focus:ring-accent/10"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
                  Password
                </span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 pr-12 text-sm outline-none transition placeholder:text-ink-soft/50 focus:border-accent focus:ring-4 focus:ring-accent/10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-ink-soft transition hover:bg-mist hover:text-ink"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="group relative mt-1 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-ink px-4 py-4 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-80"
              >
                <span className="absolute inset-0 translate-y-full bg-lime transition duration-300 group-hover:translate-y-0" />
                <span className="relative z-10 inline-flex items-center gap-2 transition group-hover:text-ink">
                  {loading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin-slow" />
                      Opening {active.label.toLowerCase()}…
                    </>
                  ) : (
                    <>
                      Continue as {active.label}
                      <ArrowUpRight className="h-4 w-4" />
                    </>
                  )}
                </span>
              </button>
            </form>

            <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-mist/90 px-4 py-3 text-[11px] text-ink-soft">
              <span className="font-semibold text-ink">Owner</span>
              <span className="font-mono">owner@pos.local · demo1234</span>
              <span className="font-semibold text-ink">Cashier</span>
              <span className="font-mono">cashier@pos.local · demo1234</span>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-white/45">
            <Link href="/" className="transition hover:text-lime">
              Back to landing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
