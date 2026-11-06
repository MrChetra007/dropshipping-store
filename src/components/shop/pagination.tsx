import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  pageCount: number;
  basePath: string;
  query?: Record<string, string | undefined>;
};

function pageWindow(page: number, pageCount: number): number[] {
  const start = Math.max(1, Math.min(page - 2, pageCount - 4));
  const end = Math.min(pageCount, start + 4);
  const pages: number[] = [];

  for (let current = start; current <= end; current += 1) {
    pages.push(current);
  }

  return pages;
}

export function Pagination({
  page,
  pageCount,
  basePath,
  query = {},
}: PaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const hrefFor = (target: number) => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params.set(key, value);
      }
    }

    if (target > 1) {
      params.set("page", String(target));
    }

    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  const pages = pageWindow(page, pageCount);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-center gap-1"
    >
      {page > 1 ? (
        <Link
          to={hrefFor(page - 1)}
          rel="prev"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Previous
        </Link>
      ) : (
        <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm text-slate-400 dark:border-slate-800">
          Previous
        </span>
      )}

      {pages[0] > 1 ? (
        <>
          <Link
            to={hrefFor(1)}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-300 px-2 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            1
          </Link>
          {pages[0] > 2 ? <span className="px-1 text-slate-400">…</span> : null}
        </>
      ) : null}

      {pages.map((item) => (
        <Link
          key={item}
          to={hrefFor(item)}
          aria-current={item === page ? "page" : undefined}
          className={cn(
            "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm transition-colors",
            item === page
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900",
          )}
        >
          {item}
        </Link>
      ))}

      {pages[pages.length - 1] < pageCount ? (
        <>
          {pages[pages.length - 1] < pageCount - 1 ? (
            <span className="px-1 text-slate-400">…</span>
          ) : null}
          <Link
            to={hrefFor(pageCount)}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-slate-300 px-2 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            {pageCount}
          </Link>
        </>
      ) : null}

      {page < pageCount ? (
        <Link
          to={hrefFor(page + 1)}
          rel="next"
          className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          Next
        </Link>
      ) : (
        <span className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm text-slate-400 dark:border-slate-800">
          Next
        </span>
      )}
    </nav>
  );
}
