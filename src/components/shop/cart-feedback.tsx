import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";

import { getCart } from "@/features/cart/cart-api";

type AddedItem = {
  title: string;
  quantity: number;
};

type Toast = AddedItem;

type CartFeedbackContextValue = {
  itemCount: number;
  notifyAdded: (item: AddedItem) => void;
  refresh: () => void;
};

const CartFeedbackContext = createContext<CartFeedbackContextValue | null>(null);

export function useCartFeedback() {
  const context = useContext(CartFeedbackContext);

  if (!context) {
    throw new Error("useCartFeedback must be used within CartFeedback");
  }

  return context;
}

export function CartFeedback({ children }: { children: ReactNode }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { data: cart } = useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
  });
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemCount = cart?.itemCount ?? 0;

  const pathname = location.pathname;
  const hidden =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/auth") ||
    pathname === "/cart" ||
    pathname === "/login" ||
    pathname === "/signup";

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["cart"] });
  }, [queryClient]);

  const notifyAdded = useCallback((item: AddedItem) => {
    setToast(item);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const value = useMemo(
    () => ({ itemCount, notifyAdded, refresh }),
    [itemCount, notifyAdded, refresh],
  );

  const dismiss = () => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    setToast(null);
  };

  return (
    <CartFeedbackContext.Provider value={value}>
      {children}

      {!hidden ? (
        <>
          {toast ? (
            <div
              role="status"
              aria-live="polite"
              className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-start gap-3 rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 bg-white p-4 shadow-xl dark:border-zinc-800 dark:border-l-emerald-500 dark:bg-zinc-900 sm:inset-x-auto sm:right-6 sm:mx-0 sm:w-80"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Added to cart</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {toast.quantity} × {toast.title}
                </p>
                <Link
                  to="/cart"
                  className="mt-2 inline-block text-sm font-medium underline underline-offset-2"
                >
                  View cart
                </Link>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss notification"
                className="-m-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                ×
              </button>
            </div>
          ) : null}

          <Link
            to="/cart"
            aria-label={`Open cart${itemCount > 0 ? `, ${itemCount} item${itemCount === 1 ? "" : "s"}` : ""}`}
            className="fixed bottom-6 right-6 z-50 inline-flex h-14 items-center gap-2 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105 hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            <span>Cart</span>
            {itemCount > 0 ? (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-xs font-semibold tabular-nums text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </>
      ) : null}
    </CartFeedbackContext.Provider>
  );
}
