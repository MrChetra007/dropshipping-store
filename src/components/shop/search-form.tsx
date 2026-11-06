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
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
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
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            ×
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        disabled={searching}
        aria-busy={searching}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
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
