import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ImportSearchForm({ query }: { query: string }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [value, setValue] = useState(query);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const params = new URLSearchParams();
    const trimmed = value.trim();
    const page = searchParams.get("page");

    if (trimmed) {
      params.set("q", trimmed);
    }

    if (page && page !== "1") {
      params.set("page", page);
    }

    const search = params.toString();
    navigate(
      search
        ? `/admin/products/import?${search}`
        : "/admin/products/import",
    );
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
        className="min-w-0 flex-1"
      />
      <Button type="submit" loadingLabel="Searching CJ…">
        Search
      </Button>
    </form>
  );
}
