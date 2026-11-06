import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

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
    "bg-slate-900 text-white hover:bg-slate-700 active:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:active:bg-slate-200",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 active:bg-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:active:bg-slate-700",
  ghost:
    "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 dark:active:bg-slate-800",
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
