"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";

export function SearchForm({
  defaultValue = "",
  category,
  placeholder = "Search products…",
}: {
  defaultValue?: string;
  category?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [syncedDefault, setSyncedDefault] = useState(defaultValue);
  const lastNavigated = useRef(defaultValue.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (defaultValue !== syncedDefault) {
    setSyncedDefault(defaultValue);
    setValue(defaultValue);
  }

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const buildHref = (next: string) => {
    const params = new URLSearchParams();
    const trimmed = next.trim();

    if (trimmed) {
      params.set("q", trimmed);
    }

    if (category) {
      params.set("category", category);
    }

    const search = params.toString();
    return search ? `/products?${search}` : "/products";
  };

  const navigate = (next: string) => {
    const trimmed = next.trim();

    if (trimmed === lastNavigated.current) {
      return;
    }

    lastNavigated.current = trimmed;
    router.replace(buildHref(next), { scroll: false });
  };

  const change = (next: string) => {
    setValue(next);

    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => navigate(next), 350);
  };

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    setValue("");
    navigate("");
  };

  return (
    <form
      action="/products"
      method="get"
      onSubmit={(event) => {
        event.preventDefault();

        if (timer.current) {
          clearTimeout(timer.current);
        }

        navigate(value);
      }}
      className="flex w-full gap-2"
    >
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <div className="relative flex-1">
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(event) => change(event.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
          className="pr-10"
        />
        {value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Search
      </button>
    </form>
  );
}
