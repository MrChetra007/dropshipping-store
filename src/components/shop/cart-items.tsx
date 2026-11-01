"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { formatCents } from "@/lib/utils";
import type { Cart } from "@/types/cart";

type PendingAction = { variantId: string; action: "update" | "remove" };

type Feedback = { tone: "success" | "error"; message: string } | null;

export function CartItems({ cart }: { cart: Cart }) {
  const router = useRouter();
  const [isRefreshing, beginRefresh] = useTransition();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      cart.items.map((item) => [item.variantId, item.quantity]),
    ),
  );
  const [syncedCart, setSyncedCart] = useState(cart);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (cart !== syncedCart) {
    setSyncedCart(cart);
    setQuantities(
      Object.fromEntries(
        cart.items.map((item) => [item.variantId, item.quantity]),
      ),
    );
  }

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const showFeedback = (next: Feedback) => {
    setFeedback(next);

    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
    }

    if (next?.tone === "success") {
      feedbackTimer.current = setTimeout(() => setFeedback(null), 3000);
    }
  };

  const changeQuantity = async (variantId: string, quantity: number) => {
    if (pending) {
      return;
    }

    const item = cart.items.find((entry) => entry.variantId === variantId);

    if (!item) {
      return;
    }

    const nextQuantity = Math.max(0, quantity);
    const previous = quantities[variantId] ?? item.quantity;
    const action = nextQuantity <= 0 ? "remove" : "update";

    setPending({ variantId, action });
    setFeedback(null);

    if (nextQuantity > 0) {
      setQuantities((current) => ({ ...current, [variantId]: nextQuantity }));
    }

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          variantId,
          quantity: nextQuantity,
        }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update your cart");
      }

      showFeedback({
        tone: "success",
        message:
          action === "remove"
            ? "Item removed from cart."
            : "Cart updated.",
      });
      beginRefresh(() => router.refresh());
    } catch (error) {
      setQuantities((current) => ({ ...current, [variantId]: previous }));
      showFeedback({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Could not update your cart",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-4">
      {feedback ? (
        <p
          role={feedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          className={`rounded-md border px-4 py-3 text-sm ${
            feedback.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {isRefreshing ? (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-zinc-500"
        >
          <Spinner className="h-3.5 w-3.5" />
          Updating totals…
        </p>
      ) : null}

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {cart.items.map((item) => {
          const maxQuantity = Math.max(
            1,
            item.stock === null ? 99 : Math.min(99, item.stock),
          );
          const rowPending = pending?.variantId === item.variantId;
          const quantity = quantities[item.variantId] ?? item.quantity;

          return (
            <li key={item.id} className="flex gap-4 p-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-900">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : null}
                {rowPending ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-zinc-600 dark:bg-zinc-950/70 dark:text-zinc-300">
                    <Spinner />
                  </span>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${item.productSlug}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.productTitle}
                    </Link>
                    {item.variantTitle && item.variantTitle !== "Default" ? (
                      <p className="text-xs text-zinc-500">
                        {item.variantTitle}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium tabular-nums">
                    {formatCents(item.lineTotalCents, item.currency)}
                  </p>
                </div>

                {!item.isActive ? (
                  <p className="text-xs font-medium text-red-600 dark:text-red-400">
                    This item is no longer available. Remove it to continue.
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                  <label
                    htmlFor={`quantity-${item.variantId}`}
                    className="text-xs text-zinc-500"
                  >
                    Qty
                  </label>
                  <select
                    id={`quantity-${item.variantId}`}
                    value={quantity}
                    disabled={rowPending || !item.isActive}
                    aria-busy={rowPending}
                    onChange={(event) =>
                      changeQuantity(item.variantId, Number(event.target.value))
                    }
                    className="h-8 rounded-lg border border-zinc-300 bg-white px-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {Array.from({ length: maxQuantity }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => changeQuantity(item.variantId, 0)}
                    disabled={rowPending}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 underline underline-offset-2 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:text-red-400"
                  >
                    {rowPending && pending?.action === "remove" ? (
                      <Spinner className="h-3 w-3" />
                    ) : null}
                    {rowPending && pending?.action === "remove"
                      ? "Removing…"
                      : "Remove"}
                  </button>
                  {rowPending && pending?.action === "update" ? (
                    <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <Spinner className="h-3 w-3" />
                      Updating…
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
