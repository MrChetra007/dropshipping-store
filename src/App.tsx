import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, ScrollRestoration } from "react-router-dom";

import { CartFeedback } from "@/components/shop/cart-feedback";
import { useAuth } from "@/features/auth/auth-context";
import { getStoreSettings } from "@/lib/catalog";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors ${
    isActive
      ? "text-slate-900 dark:text-slate-100"
      : "hover:text-slate-900 dark:hover:text-slate-100"
  }`;

export function App() {
  const { user } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["settings", "store"],
    queryFn: getStoreSettings,
  });
  const brand = settings?.name ?? "KinetiCore Labs";

  return (
    <>
      <div className="bg-slate-900 text-slate-100 dark:bg-slate-900">
        <p
          aria-label="Announcement"
          className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2.5 text-center text-xs sm:text-sm"
        >
          <span className="font-semibold tracking-wide text-slate-50">
            SPRING MOBILITY SALE
          </span>
          <span aria-hidden className="text-slate-500">
            ·
          </span>
          <span className="text-slate-300">
            Take 20% off with code
          </span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300 ring-1 ring-cyan-400/40 sm:text-xs">
            RELIEF20
          </span>
          <span aria-hidden className="text-slate-500">
            ·
          </span>
          <span className="text-slate-300">60-day pain-free trial</span>
        </p>
      </div>
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-background/80 backdrop-blur dark:border-slate-800/80">
        <nav
          aria-label="Store"
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4"
        >
          <Link to="/" className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {brand}
            </span>
            <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 sm:inline">
              Clinical-Grade Recovery
            </span>
          </Link>
          <div className="flex items-center gap-5 text-sm text-slate-600 dark:text-slate-400">
            <NavLink to="/products" className={navLinkClass}>
              Products
            </NavLink>
            <NavLink to="/cart" className={navLinkClass}>
              Cart
            </NavLink>
            <NavLink to="/account" className={navLinkClass}>
              Account
            </NavLink>
            {!user ? (
              <NavLink
                to="/login"
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium transition-colors hover:border-slate-900 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-100 dark:hover:text-slate-100"
              >
                Log in
              </NavLink>
            ) : null}
          </div>
        </nav>
      </header>
      <CartFeedback>
        <Outlet />
      </CartFeedback>
      <ScrollRestoration />
    </>
  );
}
