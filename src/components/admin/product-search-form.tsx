import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";

export function AdminProductSearchForm({
  query,
  status,
}: {
  query: string;
  status: string;
}) {
  const navigate = useNavigate();
  const [value, setValue] = useState(query);

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
    navigate(search ? `/admin/products?${search}` : "/admin/products");
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
        className="min-w-0 flex-1 sm:max-w-sm"
      />
      {status ? <input type="hidden" name="status" value={status} /> : null}
      <Button type="submit">Search</Button>
      {query || status ? (
        <ButtonLink to="/admin/products" variant="ghost" size="sm">
          Clear
        </ButtonLink>
      ) : null}
    </form>
  );
}
