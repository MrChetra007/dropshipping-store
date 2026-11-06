import type { ImgHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type SmartImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  src: string;
  alt: string;
  priority?: boolean;
  fill?: boolean;
};

export function SmartImage({
  src,
  alt,
  priority = false,
  fill = false,
  className,
  ...props
}: SmartImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cn(
        fill ? "absolute inset-0 h-full w-full object-cover" : "h-full w-full object-cover",
        className,
      )}
      {...props}
    />
  );
}
