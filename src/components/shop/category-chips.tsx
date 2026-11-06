import { Link } from "react-router-dom";

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
        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
        : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900",
    );

  return (
    <nav aria-label="Product categories" className="flex flex-wrap gap-2">
      <Link to={hrefFor()} className={chipClass(!activeSlug)}>
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          to={hrefFor(category.slug)}
          className={chipClass(activeSlug === category.slug)}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
