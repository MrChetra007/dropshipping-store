type Tone = "neutral" | "good" | "bad";

export function toneFor(value: string): Tone {
  if (["paid", "submitted", "confirmed", "shipped", "delivered"].includes(value)) {
    return "good";
  }

  if (["failed", "cancelled", "refunded"].includes(value)) {
    return "bad";
  }

  return "neutral";
}

const toneStyles: Record<Tone, string> = {
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  bad: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
};

export function Badge({
  value,
  tone = "neutral",
}: {
  value: string;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${toneStyles[tone]}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

const statusStyles: Record<string, string> = {
  active:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  draft:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  archived:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${
        statusStyles[status] ?? statusStyles.archived
      }`}
    >
      {status}
    </span>
  );
}
