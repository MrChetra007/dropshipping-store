import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";

import { NotificationBell } from "@/components/admin/notification-bell";
import { RequireAdmin } from "@/features/auth/require-auth";
import { signOut } from "@/features/auth/auth-actions";

export function AdminLayout() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);

    try {
      await signOut();
      navigate("/", { replace: true });
    } finally {
      setPending(false);
    }
  };

  return (
    <RequireAdmin>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <nav aria-label="Admin" className="flex items-center gap-6">
              <Link to="/admin" className="font-semibold tracking-tight">
                Admin
              </Link>
              <Link
                to="/admin"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Dashboard
              </Link>
              <Link
                to="/admin/products"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Products
              </Link>
              <Link
                to="/admin/orders"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Orders
              </Link>
              <Link
                to="/"
                className="text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                View store
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <span className="hidden text-sm text-zinc-500 sm:inline">
                Admin
              </span>
              <span
                aria-hidden
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
              >
                A
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={pending}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
          <Outlet />
        </div>
      </div>
    </RequireAdmin>
  );
}
