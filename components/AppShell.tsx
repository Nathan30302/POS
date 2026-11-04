"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  LogOut,
  Package,
  ShoppingCart,
  Store,
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
      <header className="sticky top-0 z-40 border-b border-line/80 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-white shadow-sm">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-ink">POS</p>
              <p className="text-xs text-ink-soft">{user.shopName}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => {
              const active = pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-accent text-white"
                      : "text-ink-soft hover:bg-paper-deep hover:text-ink"
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
              <p className="text-sm font-medium text-ink">{user.name}</p>
              <p className="text-xs uppercase tracking-wide text-ink-soft">
                {user.role.toLowerCase()}
              </p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-sm text-ink-soft transition hover:border-accent hover:text-accent"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <div className="flex gap-1 overflow-x-auto border-t border-line/60 px-4 py-2 md:hidden">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                  active
                    ? "bg-accent text-white"
                    : "bg-paper-deep text-ink-soft"
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
