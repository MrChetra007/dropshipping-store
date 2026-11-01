"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function FormSubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      loading={pending}
      loadingLabel={pendingLabel}
      {...props}
    >
      {children}
    </Button>
  );
}
