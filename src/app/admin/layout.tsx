import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/lib/auth-actions";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await connection();

  const { user, profile } = await requireAdmin();
  const displayName = profile.full_name || user.email || "Admin";
  const initials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <nav aria-label="Admin" className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold tracking-tight">
              Admin
            </Link>
            <Link
              href="/admin"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/products"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Products
            </Link>
            <Link
              href="/admin/orders"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Orders
            </Link>
            <Link
              href="/"
              className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View store
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {displayName}
            </span>
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {initials}
            </span>
            <form action={logout}>
              <FormSubmitButton
                pendingLabel="Logging out…"
                className="h-9 bg-transparent px-3 text-zinc-900 hover:bg-zinc-100 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Log out
              </FormSubmitButton>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
    </div>
  );
}
