import type { ButtonHTMLAttributes } from "react";

import { Spinner } from "@/components/ui/spinner";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
};

export function Button({
  className = "",
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-700 active:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300 dark:active:bg-slate-200 ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}
