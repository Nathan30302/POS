"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

const demos = [
  {
    label: "Owner",
    email: "owner@pos.local",
    password: "demo1234",
    hint: "Dashboard, products, totals",
  },
  {
    label: "Cashier",
    email: "cashier@pos.local",
    password: "demo1234",
    hint: "Till, scan, checkout",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("cashier@pos.local");
  const [password, setPassword] = useState("demo1234");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState("Cashier");

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
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <Image
          src="/hero-counter.jpg"
          alt=""
          fill
          priority
          className="object-cover opacity-70"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="hero-grid absolute inset-0 opacity-30" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <Link href="/" className="font-display text-3xl font-extrabold tracking-tight">
            POS
          </Link>

          <div className="max-w-md animate-rise">
            <p className="mb-4 text-sm uppercase tracking-[0.24em] text-lime">
              Live sample
            </p>
            <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight">
              Sign in and sell something.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-white/70">
              Use the demo accounts to walk a full sale — from scan to mobile
              money — then show the owner dashboard.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {["/products/pen-black.jpg", "/products/exercise-book.jpg", "/products/a4-paper.jpg"].map(
              (src) => (
                <div
                  key={src}
                  className="relative aspect-square overflow-hidden rounded-2xl border border-white/15"
                >
                  <Image src={src} alt="" fill className="object-cover" sizes="120px" />
                </div>
              )
            )}
          </div>
        </div>
      </aside>

      <main className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-lime/20 blur-3xl" />
        </div>

        <div className="relative w-full max-w-md animate-rise">
          <Link
            href="/"
            className="mb-8 inline-flex font-display text-2xl font-extrabold tracking-tight text-ink lg:hidden"
          >
            POS
          </Link>

          <div className="rounded-[2rem] border border-line bg-card p-7 shadow-[var(--shadow)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Welcome back
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
              Enter the demo
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Pick a role, then open the till or the owner view.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2">
              {demos.map((demo) => {
                const active = activeDemo === demo.label;
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
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-accent bg-accent-soft shadow-sm"
                        : "border-line bg-mist/60 hover:border-accent/40"
                    }`}
                  >
                    <p className="text-sm font-semibold text-ink">{demo.label}</p>
                    <p className="mt-1 text-xs text-ink-soft">{demo.hint}</p>
                  </button>
                );
              })}
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-ink">Password</span>
                <div className="relative">
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-2xl border border-line bg-white px-4 py-3.5 pr-12 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-soft hover:bg-mist hover:text-ink"
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
                <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-danger">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3.5 font-semibold text-white transition hover:bg-black disabled:opacity-60"
              >
                {loading ? "Opening…" : `Continue as ${activeDemo}`}
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-6 rounded-2xl bg-mist px-4 py-3 text-xs leading-relaxed text-ink-soft">
              <p className="font-semibold text-ink">Demo passwords</p>
              <p className="mt-1">owner@pos.local · cashier@pos.local</p>
              <p>Password for both: demo1234</p>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-ink-soft">
            <Link href="/" className="font-medium text-accent hover:text-accent-deep">
              ← Back to landing
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
