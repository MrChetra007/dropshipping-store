import { HttpError } from "./http.ts";

/**
 * Public storefront origin used for redirect URLs and links in emails. It is a
 * Supabase function secret so the Next.js app does not need to know it.
 */
export function siteUrl(): string {
  return (Deno.env.get("SITE_URL") ?? "").trim().replace(/\/+$/, "");
}

export function requireSiteUrl(): string {
  const url = siteUrl();

  if (!url) {
    throw new HttpError(500, "SITE_URL is not configured");
  }

  return url;
}
