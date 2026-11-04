"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft hover:border-accent hover:text-accent"
    >
      Logout
    </button>
  );
}
