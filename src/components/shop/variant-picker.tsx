import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCartFeedback } from "@/components/shop/cart-feedback";
import { PriceTag } from "@/components/shop/price-tag";
import { Spinner } from "@/components/ui/spinner";
import { addToCart } from "@/features/cart/cart-api";
import { cn } from "@/lib/utils";

export type PickerVariant = {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  stock: number | null;
};

function isAvailable(variant: PickerVariant): boolean {
  return variant.stock === null || variant.stock > 0;
}

export function VariantPicker({
  variants,
  productTitle,
}: {
  variants: PickerVariant[];
  productTitle?: string;
}) {
  const queryClient = useQueryClient();
  const initial = variants.find(isAvailable) ?? variants[0];
  const [selectedId, setSelectedId] = useState(initial?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { notifyAdded } = useCartFeedback();
  const selected = variants.find((variant) => variant.id === selectedId) ?? initial;

  useEffect(() => {
    if (status !== "added") {
      return;
    }

    const timer = setTimeout(() => setStatus("idle"), 4000);

    return () => clearTimeout(timer);
  }, [status]);

  const optionGroups = useMemo(() => {
    const groups = new Map<string, string[]>();

    for (const variant of variants) {
      for (const [name, value] of Object.entries(variant.options)) {
        const values = groups.get(name) ?? [];

        if (!values.includes(value)) {
          values.push(value);
        }

        groups.set(name, values);
      }
    }

    return [...groups.entries()].map(([name, values]) => ({ name, values }));
  }, [variants]);

  if (!selected) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        This product is currently unavailable.
      </p>
    );
  }

  const available = isAvailable(selected);
  const maxQuantity = Math.max(
    1,
    selected.stock === null ? 10 : Math.min(10, selected.stock),
  );

  const selectVariant = (id: string) => {
    setSelectedId(id);
    setStatus("idle");
    setErrorMessage(null);
    setQuantity(1);
  };

  const add = async () => {
    if (!available || status === "adding") {
      return;
    }

    setStatus("adding");
    setErrorMessage(null);

    try {
      const updated = await addToCart(selected.id, quantity);
      queryClient.setQueryData(["cart"], updated);
      setStatus("added");
      notifyAdded({ title: productTitle ?? selected.title, quantity });
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Could not add this item",
      );
    }
  };

  const matches = (options: Record<string, string>) =>
    variants.filter((variant) =>
      Object.entries(options).every(
        ([name, value]) => variant.options[name] === value,
      ),
    );

  const chooseOption = (name: string, value: string) => {
    const desired = { ...selected.options, [name]: value };
    const candidates = matches(desired);
    const next = candidates.find(isAvailable) ?? candidates[0];

    if (next) {
      selectVariant(next.id);
    }
  };

  const optionAvailable = (name: string, value: string) => {
    const desired = { ...selected.options, [name]: value };
    return matches(desired).some(isAvailable);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <PriceTag
          priceCents={selected.priceCents}
          compareAtCents={selected.compareAtCents}
          currency={selected.currency}
          className="text-2xl"
        />
        <p
          className={cn(
            "text-sm font-medium",
            available
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {available
            ? selected.stock === null
              ? "In stock"
              : `In stock · ${selected.stock} available`
            : "Out of stock"}
        </p>
        {selected.sku ? (
          <p className="font-mono text-xs text-slate-500">SKU {selected.sku}</p>
        ) : null}
      </div>

      {optionGroups.length > 0 ? (
        <div className="space-y-4">
          {optionGroups.map((group) => (
            <div key={group.name} className="space-y-2">
              <p className="text-sm font-medium">{group.name}</p>
              <div className="flex flex-wrap gap-2">
                {group.values.map((value) => {
                  const isSelected = selected.options[group.name] === value;
                  const canSelect = optionAvailable(group.name, value);

                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseOption(group.name, value)}
                      disabled={!canSelect}
                      aria-pressed={isSelected}
                      className={cn(
                        "inline-flex h-9 items-center rounded-lg border px-3 text-sm transition-colors",
                        isSelected
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900",
                        !canSelect && "cursor-not-allowed opacity-40",
                      )}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : variants.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Options</p>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isSelected = variant.id === selected.id;
              const canSelect = isAvailable(variant);

              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => selectVariant(variant.id)}
                  disabled={!canSelect}
                  aria-pressed={isSelected}
                  className={cn(
                    "inline-flex h-9 items-center rounded-lg border px-3 text-sm transition-colors",
                    isSelected
                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                      : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900",
                    !canSelect && "cursor-not-allowed opacity-40",
                  )}
                >
                  {variant.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{selected.title}</p>
      )}

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={!available || quantity <= 1}
              aria-label="Decrease quantity"
              className="flex h-full w-10 items-center justify-center text-lg text-slate-600 transition-colors hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-100"
            >
              −
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center text-sm tabular-nums"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() =>
                setQuantity((current) => Math.min(maxQuantity, current + 1))
              }
              disabled={!available || quantity >= maxQuantity}
              aria-label="Increase quantity"
              className="flex h-full w-10 items-center justify-center text-lg text-slate-600 transition-colors hover:text-slate-900 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-100"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!available || status === "adding"}
            aria-busy={status === "adding"}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            {status === "adding" ? <Spinner /> : null}
            {status === "adding"
              ? "Adding…"
              : available
                ? "Add to cart"
                : "Out of stock"}
          </button>
        </div>
        {status === "error" && errorMessage ? (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
        {status === "added" ? (
          <p
            role="status"
            aria-live="polite"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Added to cart.{" "}
            <Link to="/cart" className="font-medium underline underline-offset-2">
              View cart
            </Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
