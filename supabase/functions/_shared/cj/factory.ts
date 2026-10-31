import { createAdminClient } from "../supabase.ts";
import { CjClient } from "./client.ts";
import { CjConfigError } from "./errors.ts";
import { SupabaseCjTokenStore } from "./supabase-token-store.ts";

export function createCjClient(): CjClient {
  const apiKey = Deno.env.get("CJ_API_KEY")?.trim();

  if (!apiKey) {
    throw new CjConfigError("CJ_API_KEY is not configured");
  }

  return new CjClient({
    apiKey,
    tokenStore: new SupabaseCjTokenStore(createAdminClient()),
  });
}
