import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const sizes: Record<Size, string> = {
  xs: "h-8 px-2.5 text-xs",
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 active:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:active:bg-zinc-200",
  secondary:
    "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100 active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
  ghost:
    "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 active:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:active:bg-zinc-800",
  danger:
    "text-red-600 hover:bg-red-50 hover:text-red-700 active:bg-red-100 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300 dark:active:bg-red-900",
};

type StyleOptions = {
  variant?: Variant;
  size?: Size;
  className?: string;
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: StyleOptions = {}) {
  return cn(base, sizes[size], variants[variant], className);
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & Omit<StyleOptions, "className">) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...props} />
  );
}

export function ButtonAnchor({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"a"> & Omit<StyleOptions, "className">) {
  return (
    <a className={buttonClass({ variant, size, className })} {...props} />
  );
}
