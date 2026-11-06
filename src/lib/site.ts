import { env } from "@/lib/env";

export function siteUrl(): string {
  return env.VITE_SITE_URL.replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
