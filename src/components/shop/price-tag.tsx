import { cn, formatCents } from "@/lib/utils";

export function PriceTag({
  priceCents,
  compareAtCents,
  currency = "USD",
  className,
}: {
  priceCents: number | null;
  compareAtCents?: number | null;
  currency?: string;
  className?: string;
}) {
  if (priceCents === null) {
    return (
      <span className={cn("text-sm text-slate-500", className)}>
        Price unavailable
      </span>
    );
  }

  const showCompareAt =
    compareAtCents !== null &&
    compareAtCents !== undefined &&
    compareAtCents > priceCents;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-semibold tabular-nums">
        {formatCents(priceCents, currency)}
      </span>
      {showCompareAt ? (
        <span className="text-sm text-slate-400 line-through tabular-nums">
          {formatCents(compareAtCents, currency)}
        </span>
      ) : null}
    </span>
  );
}
