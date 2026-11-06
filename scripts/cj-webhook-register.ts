import {
  CjClient,
  MemoryCjTokenStore,
  setWebhook,
  SupabaseCjTokenStore,
} from "../supabase/functions/_shared/cj/index.ts";
import { createAdminClient } from "../supabase/functions/_shared/supabase.ts";

const apiKey = Deno.env.get("CJ_API_KEY")?.trim();
const callbackUrl = Deno.env.get("CJ_WEBHOOK_URL")?.trim();
const hasSupabaseEnv = Boolean(
  Deno.env.get("SUPABASE_URL") && Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

if (!apiKey) {
  console.error("CJ_API_KEY is not set.");
  console.error(
    'PowerShell: $env:CJ_API_KEY="..." ; $env:CJ_WEBHOOK_URL="https://.../functions/v1/cj-webhook" ; npm run cj:webhook',
  );
  Deno.exit(1);
}

if (!callbackUrl) {
  console.error("CJ_WEBHOOK_URL is not set.");
  console.error(
    'Use the deployed HTTPS URL, e.g. https://<project-ref>.supabase.co/functions/v1/cj-webhook',
  );
  Deno.exit(1);
}

const client = new CjClient({
  apiKey,
  tokenStore: hasSupabaseEnv
    ? new SupabaseCjTokenStore(createAdminClient())
    : new MemoryCjTokenStore(),
});

const enabled = await setWebhook(client, { callbackUrl });
const openId = await client.getOpenId();

console.log("CJ webhook registration");
console.log(`Callback: ${callbackUrl}`);
console.log(`Enabled: ${enabled}`);

if (openId.length <= 4) {
  console.log("openId: stored");
} else {
  console.log(`openId: ***${openId.slice(-4)}`);
}

console.log("");
console.log(
  hasSupabaseEnv
    ? "openId and tokens were persisted to supplier_tokens."
    : "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist the openId; otherwise the webhook function fetches it on the first push.",
);
