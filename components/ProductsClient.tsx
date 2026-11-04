"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { formatZMW } from "@/lib/money";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  price: number;
  stockQty: number;
  reorderLevel: number;
  category: string;
  imageUrl: string | null;
};

const emptyForm = {
  name: "",
  barcode: "",
  sku: "",
  category: "Writing",
  price: "",
  stockQty: "",
  reorderLevel: "10",
  imageUrl: "",
};

export function ProductsClient({ initialProducts }: { initialProducts: Product[] }) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      barcode: product.barcode,
      sku: product.sku,
      category: product.category,
      price: String(product.price),
      stockQty: String(product.stockQty),
      reorderLevel: String(product.reorderLevel),
      imageUrl: product.imageUrl || "",
    });
    setError("");
    setOpen(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    const payload = {
      name: form.name,
      barcode: form.barcode,
      sku: form.sku,
      category: form.category,
      price: Number(form.price),
      stockQty: Number(form.stockQty),
      reorderLevel: Number(form.reorderLevel),
      imageUrl: form.imageUrl || null,
    };

    try {
      const res = await fetch(
        editing ? `/api/products/${editing.id}` : "/api/products",
        {
          method: editing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Save failed");
        setBusy(false);
        return;
      }

      setProducts((prev) => {
        if (editing) {
          return prev.map((p) => (p.id === data.product.id ? data.product : p));
        }
        return [...prev, data.product].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setOpen(false);
      router.refresh();
    } catch {
      setError("Could not save product");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-2xl border border-line bg-card py-3 pl-11 pr-4 outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-3 font-semibold text-white hover:bg-black"
        >
          <Plus className="h-4 w-4" />
          Add product
        </button>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-mist-deep/80 text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">SKU / Barcode</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Stock</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const low = product.stockQty <= product.reorderLevel;
                return (
                  <tr key={product.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-xl bg-mist-deep">
                          {product.imageUrl ? (
                            <Image
                              src={product.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className="font-medium text-ink">{product.name}</p>
                          <p className="text-xs text-ink-soft">
                            {product.category}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                      <div>{product.sku}</div>
                      <div>{product.barcode}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatZMW(product.price)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          low
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {product.stockQty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(product)}
                        className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-card p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editing ? "Edit product" : "Add product"}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 hover:bg-mist"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Name", "text"],
                  ["category", "Category", "text"],
                  ["barcode", "Barcode", "text"],
                  ["sku", "SKU", "text"],
                  ["price", "Price (ZMW)", "number"],
                  ["stockQty", "Stock qty", "number"],
                  ["reorderLevel", "Reorder level", "number"],
                  ["imageUrl", "Image URL", "text"],
                ] as const
              ).map(([key, label, type]) => (
                <label
                  key={key}
                  className={`block space-y-1.5 ${
                    key === "name" || key === "imageUrl" ? "sm:col-span-2" : ""
                  }`}
                >
                  <span className="text-sm text-ink-soft">{label}</span>
                  <input
                    type={type}
                    step={type === "number" ? "0.01" : undefined}
                    value={form[key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [key]: e.target.value }))
                    }
                    required={key !== "imageUrl"}
                    className="w-full rounded-2xl border border-line px-3 py-2.5 outline-none ring-accent/20 focus:ring-4"
                  />
                </label>
              ))}
            </div>

            {error ? (
              <p className="mt-3 rounded-2xl bg-red-50 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full rounded-2xl bg-ink py-3 font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save product"}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
