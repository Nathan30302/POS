"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import { formatZMW } from "@/lib/money";

type Product = {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  price: number;
  stockQty: number;
  category: string;
  imageUrl: string | null;
};

type CartItem = {
  product: Product;
  qty: number;
};

type PaymentMethod = "CASH" | "AIRTEL" | "MTN" | "ZAMTEL";

type CompletedSale = {
  id: string;
  total: number;
  lines: { qty: number; unitPrice: number; product: { name: string } }[];
  payments: { method: PaymentMethod; amount: number; reference: string | null }[];
  cashier: { name: string };
  createdAt: string;
};

const METHODS: { id: PaymentMethod; label: string; color: string }[] = [
  { id: "CASH", label: "Cash", color: "bg-emerald-600" },
  { id: "AIRTEL", label: "Airtel", color: "bg-red-600" },
  { id: "MTN", label: "MTN", color: "bg-yellow-400 text-ink" },
  { id: "ZAMTEL", label: "Zamtel", color: "bg-blue-600" },
];

export function TillClient({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<CompletedSale | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [payOpen, receipt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );
  }, [products, query]);

  const total = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const tenderedNum = Number(tendered || 0);
  const change = method === "CASH" ? Math.max(0, tenderedNum - total) : 0;

  function addToCart(product: Product) {
    if (product.stockQty <= 0) {
      setError(`${product.name} is out of stock`);
      return;
    }
    setError("");
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        if (existing.qty >= product.stockQty) {
          setError(`Only ${product.stockQty} in stock`);
          return prev;
        }
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { product, qty: 1 }];
    });
    setQuery("");
    inputRef.current?.focus();
  }

  function onSearchSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const exact =
      products.find((p) => p.barcode === q) ||
      products.find((p) => p.sku.toLowerCase() === q.toLowerCase());
    if (exact) {
      addToCart(exact);
      return;
    }
    if (filtered.length === 1) {
      addToCart(filtered[0]);
    }
  }

  function updateQty(productId: string, qty: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id !== productId) return item;
          const next = Math.max(1, Math.min(qty, item.product.stockQty));
          return { ...item, qty: next };
        })
        .filter((item) => item.qty > 0)
    );
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  async function completeSale() {
    if (!cart.length) return;
    if (method === "CASH" && tenderedNum < total) {
      setError("Cash tendered is less than total");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cart.map((i) => ({ productId: i.product.id, qty: i.qty })),
          payments: [
            {
              method,
              amount: total,
              reference: method === "CASH" ? undefined : reference || undefined,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sale failed");
        setBusy(false);
        return;
      }

      setProducts((prev) =>
        prev.map((p) => {
          const line = cart.find((c) => c.product.id === p.id);
          if (!line) return p;
          return { ...p, stockQty: p.stockQty - line.qty };
        })
      );
      setReceipt(data.sale);
      setCart([]);
      setPayOpen(false);
      setTendered("");
      setReference("");
      setMethod("CASH");
    } catch {
      setError("Could not complete sale");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
      <section className="space-y-4">
        <form onSubmit={onSearchSubmit} className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Scan barcode or search name / SKU…"
            className="w-full rounded-[1.6rem] border border-line bg-card py-4 pl-12 pr-4 text-lg shadow-[var(--shadow)] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </form>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product) => {
            const low = product.stockQty <= 10;
            const out = product.stockQty <= 0;
            return (
              <button
                key={product.id}
                type="button"
                disabled={out}
                onClick={() => addToCart(product)}
                className="group overflow-hidden rounded-[1.5rem] border border-line bg-card text-left shadow-sm transition hover:-translate-y-1 hover:border-accent hover:shadow-[var(--shadow)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="relative aspect-square bg-mist-deep">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      className="object-cover transition group-hover:scale-[1.03]"
                      sizes="180px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-ink-soft">
                      No image
                    </div>
                  )}
                  {low ? (
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        out ? "bg-danger text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {out ? "Out" : "Low"}
                    </span>
                  ) : null}
                </div>
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-ink">
                    {product.name}
                  </p>
                  <p className="font-semibold text-accent">
                    {formatZMW(product.price)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    Stock {product.stockQty} · {product.sku}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="h-fit rounded-[2rem] border border-line bg-card p-5 shadow-[var(--shadow)] lg:sticky lg:top-24">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-accent" />
            <h2 className="font-display text-lg font-bold">Cart</h2>
          </div>
          {cart.length ? (
            <button
              type="button"
              onClick={() => setCart([])}
              className="text-sm text-ink-soft hover:text-danger"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {!cart.length ? (
            <div className="rounded-3xl border border-dashed border-line bg-mist/80 px-4 py-10 text-center text-sm text-ink-soft">
              Scan or tap a product to start a sale
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product.id}
                className="flex gap-3 rounded-2xl border border-line bg-white p-3"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-mist-deep">
                  {item.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.product.name}</p>
                  <p className="text-sm text-accent">
                    {formatZMW(item.product.price)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, item.qty - 1)}
                      className="rounded-lg border border-line p-1 hover:bg-mist"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product.id, item.qty + 1)}
                      className="rounded-lg border border-line p-1 hover:bg-mist"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="ml-auto rounded-lg p-1 text-ink-soft hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold">
                  {formatZMW(item.product.price * item.qty)}
                </p>
              </div>
            ))
          )}
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-4 flex items-end justify-between">
            <span className="text-ink-soft">Total</span>
            <span className="font-display text-3xl font-extrabold tracking-tight">
              {formatZMW(total)}
            </span>
          </div>
          <button
            type="button"
            disabled={!cart.length}
            onClick={() => {
              setError("");
              setPayOpen(true);
              setTendered(total ? String(total.toFixed(2)) : "");
            }}
            className="w-full rounded-2xl bg-ink py-3.5 font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            Charge {formatZMW(total)}
          </button>
        </div>
      </aside>

      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Take payment</h3>
              <button
                type="button"
                onClick={() => setPayOpen(false)}
                className="rounded-full p-2 hover:bg-mist"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 font-display text-3xl font-extrabold text-accent">
              {formatZMW(total)}
            </p>

            <div className="mb-4 grid grid-cols-2 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`rounded-2xl px-3 py-3 text-sm font-medium text-white transition ${
                    method === m.id
                      ? `${m.color} ring-4 ring-offset-2 ring-accent/20`
                      : `${m.color} opacity-70`
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {method === "CASH" ? (
              <label className="mb-3 block space-y-1.5">
                <span className="text-sm text-ink-soft">Cash tendered</span>
                <input
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value)}
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full rounded-2xl border border-line px-4 py-3 outline-none ring-accent/20 focus:ring-4"
                />
                <p className="text-sm text-ink-soft">
                  Change:{" "}
                  <span className="font-semibold text-ink">
                    {formatZMW(change)}
                  </span>
                </p>
              </label>
            ) : (
              <label className="mb-3 block space-y-1.5">
                <span className="text-sm text-ink-soft">
                  Reference (optional)
                </span>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Last 4 digits or txn id"
                  className="w-full rounded-2xl border border-line px-4 py-3 outline-none ring-accent/20 focus:ring-4"
                />
              </label>
            )}

            {error ? (
              <p className="mb-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              disabled={busy}
              onClick={completeSale}
              className="w-full rounded-2xl bg-ink py-3.5 font-medium text-white hover:bg-black disabled:opacity-60"
            >
              {busy ? "Saving sale..." : "Confirm paid"}
            </button>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-[2rem] bg-card p-6 shadow-2xl">
            <div className="mb-3 flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <h3 className="text-xl font-semibold text-ink">Sale complete</h3>
            </div>
            <p className="text-sm text-ink-soft">
              Receipt #{receipt.id.slice(-8).toUpperCase()} ·{" "}
              {receipt.cashier.name}
            </p>
            <div className="my-4 space-y-2 border-y border-dashed border-line py-4">
              {receipt.lines.map((line, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>
                    {line.qty} × {line.product.name}
                  </span>
                  <span>{formatZMW(line.qty * line.unitPrice)}</span>
                </div>
              ))}
            </div>
            <div className="mb-2 flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatZMW(receipt.total)}</span>
            </div>
            {receipt.payments.map((p, idx) => (
              <p key={idx} className="text-sm text-ink-soft">
                Paid via {p.method}
                {p.reference ? ` · ${p.reference}` : ""}
              </p>
            ))}
            <button
              type="button"
              onClick={() => {
                setReceipt(null);
                inputRef.current?.focus();
              }}
              className="mt-5 w-full rounded-2xl bg-accent py-3 font-medium text-white hover:bg-accent-deep"
            >
              New sale
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
