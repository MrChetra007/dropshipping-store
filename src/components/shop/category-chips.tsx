import Link from "next/link";

import type { CategorySummary } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export function CategoryChips({
  categories,
  activeSlug,
  query,
}: {
  categories: CategorySummary[];
  activeSlug?: string;
  query?: string;
}) {
  if (categories.length === 0) {
    return null;
  }

  const hrefFor = (slug?: string) => {
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    if (slug) {
      params.set("category", slug);
    }

    const search = params.toString();
    return search ? `/products?${search}` : "/products";
  };

  const chipClass = (active: boolean) =>
    cn(
      "inline-flex h-9 items-center rounded-full border px-4 text-sm transition-colors",
      active
        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
        : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900",
    );

  return (
    <nav aria-label="Product categories" className="flex flex-wrap gap-2">
      <Link href={hrefFor()} className={chipClass(!activeSlug)}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={hrefFor(category.slug)}
          className={chipClass(activeSlug === category.slug)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
