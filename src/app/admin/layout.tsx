import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/lib/auth-actions";

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await requireAdmin();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold tracking-tight">
              Admin
            </Link>
            <Link
              href="/admin/products"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Products
            </Link>
            <Link
              href="/admin/orders"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Orders
            </Link>
            <Link
              href="/"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              View store
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">
              {profile.full_name || user.email}
            </span>
            <form action={logout}>
              <Button
                type="submit"
                className="h-9 bg-transparent px-3 text-zinc-900 hover:bg-zinc-100 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Log out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
    </div>
  );
}
