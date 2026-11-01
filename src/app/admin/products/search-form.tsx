"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { startNavigation } from "@/lib/navigation-events";

export function AdminProductSearchForm({
  query,
  status,
}: {
  query: string;
  status: string;
}) {
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

    if (status) {
      params.set("status", status);
    }

    const search = params.toString();
    startNavigation();

    beginTransition(() => {
      router.push(search ? `/admin/products?${search}` : "/admin/products");
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2">
      <Input
        type="search"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by title or slug"
        aria-label="Search products"
        aria-busy={isPending}
        className="min-w-0 flex-1 sm:max-w-sm"
      />
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <Button type="submit" loading={isPending} loadingLabel="Searching…">
        Search
      </Button>
      {query || status ? (
        <ButtonLink href="/admin/products" variant="ghost" size="sm">
          Clear
        </ButtonLink>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {isPending ? "Searching products…" : ""}
      </span>
    </form>
  );
}
