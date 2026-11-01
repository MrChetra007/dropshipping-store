"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startNavigation } from "@/lib/navigation-events";

export function ImportSearchForm({ query }: { query: string }) {
  const router = useRouter();
  const [value, setValue] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  const [isPending, beginTransition] = useTransition();

  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setValue(query);
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const trimmed = value.trim();

    if (trimmed) {
      params.set("q", trimmed);
    }

    const search = params.toString();
    startNavigation();

    beginTransition(() => {
      router.push(
        search ? `/admin/products/import?${search}` : "/admin/products/import",
      );
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search CJ products by keyword"
        aria-label="Search CJ products"
        aria-busy={isPending}
        className="min-w-0 flex-1"
      />
      <Button type="submit" loading={isPending} loadingLabel="Searching CJ…">
        Search
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "Searching the CJ catalog…" : ""}
      </span>
    </form>
  );
}
