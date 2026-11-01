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
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 active:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:active:bg-zinc-200 ${className}`}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}
