import { Link, NavLink, Outlet, ScrollRestoration } from "react-router-dom";

import { CartFeedback } from "@/components/shop/cart-feedback";
import { useAuth } from "@/features/auth/auth-context";

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `transition-colors ${
    isActive
      ? "text-zinc-900 dark:text-zinc-100"
      : "hover:text-zinc-900 dark:hover:text-zinc-100"
  }`;

export function App() {
  const { user } = useAuth();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
        <nav
          aria-label="Store"
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4"
        >
          <Link to="/" className="text-[15px] font-semibold tracking-tight">
            CJ Store
          </Link>
          <div className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
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
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
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
