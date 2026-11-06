import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export function SearchForm({
  defaultValue = "",
  category,
  placeholder = "Search products…",
}: {
  defaultValue?: string;
  category?: string;
  placeholder?: string;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);
  const [debouncing, setDebouncing] = useState(false);
  const lastNavigated = useRef(defaultValue.trim());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const go = (next: string) => {
    const trimmed = next.trim();

    setDebouncing(false);

    if (trimmed === lastNavigated.current) {
      return;
    }

    lastNavigated.current = trimmed;
    navigate(buildHref(next), { replace: true });
  };

  const change = (next: string) => {
    setValue(next);
    setDebouncing(true);

    if (timer.current) {
      clearTimeout(timer.current);
    }

    timer.current = setTimeout(() => go(next), 350);
  };

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    setValue("");
    go("");
  };

  const searching = debouncing;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();

        if (timer.current) {
          clearTimeout(timer.current);
        }

        go(value);
      }}
      className="flex w-full gap-2"
    >
      <div className="relative flex-1">
        <Input
          type="search"
          name="q"
          value={value}
          onChange={(event) => change(event.target.value)}
          placeholder={placeholder}
          aria-label="Search products"
          aria-busy={searching}
          className="pr-10"
        />
        {searching ? (
          <span
            aria-hidden
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-400 ${
              value ? "right-10" : "right-3"
            }`}
          >
            <Spinner />
          </span>
        ) : null}
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
        disabled={searching}
        aria-busy={searching}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {searching ? <Spinner /> : null}
        {searching ? "Searching…" : "Search"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {searching ? "Searching products…" : ""}
      </span>
    </form>
  );
}
