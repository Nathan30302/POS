"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
} from "lucide-react";

type Props = {
  children: React.ReactNode;
  user: {
    name: string;
    role: string;
    shopName: string;
  };
};

export function AppShell({ children, user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const isOwner = user.role === "OWNER";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const links = [
    ...(isOwner
      ? [
          { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { href: "/products", label: "Products", icon: Package },
        ]
      : []),
    { href: "/till", label: "Till", icon: ShoppingCart },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-card/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink font-display text-lg font-extrabold text-lime shadow-sm">
              P
            </div>
            <div>
              <p className="font-display text-base font-bold tracking-tight text-ink">
                POS
              </p>
              <p className="text-xs text-ink-soft">{user.shopName}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 rounded-full border border-line bg-mist/70 p-1 md:flex">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-ink text-white shadow-sm"
                      : "text-ink-soft hover:bg-white hover:text-ink"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink">{user.name}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                {user.role.toLowerCase()}
              </p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink-soft transition hover:border-ink hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${
                  active ? "bg-ink text-white" : "bg-mist-deep text-ink-soft"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6">{children}</main>
    </div>
  );
}
