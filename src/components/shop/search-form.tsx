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
  return (
    <form action="/products" method="get" className="flex w-full gap-2">
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        aria-label="Search products"
        className="flex-1"
      />
      <button
        type="submit"
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-md bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Search
      </button>
    </form>
  );
}
