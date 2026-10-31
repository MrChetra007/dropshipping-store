type EdgeRuntimeLike = {
  waitUntil(promise: Promise<unknown>): void;
};

/**
 * Keep a promise alive after the HTTP response is sent. Supabase's edge runtime
 * exposes `EdgeRuntime.waitUntil`; locally/outside it we still attach a catch so
 * failures never become unhandled rejections.
 */
export function waitUntil(promise: Promise<unknown>): void {
  const guarded = promise.catch((error) => {
    console.error("Background task failed:", error);
  });
  const runtime = (globalThis as { EdgeRuntime?: EdgeRuntimeLike }).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(guarded);
    return;
  }

  void guarded;
}

/**
 * Kick the fulfillment worker immediately after payment. The supplier_orders row
 * is already queued by mark_order_paid, so a failed kick is not fatal — the cron
 * worker will claim it on the next run. The worker (added in step 8) is the same
 * function the cron route calls.
 */
export async function triggerFulfillment(
  supplierOrderId: string,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!supabaseUrl || !cronSecret) {
    console.warn(
      "Fulfillment trigger skipped: SUPABASE_URL/CRON_SECRET not set; the cron worker will pick up the queued order",
    );
    return;
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/fulfill-order`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ supplierOrderId }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    console.error(
      `Fulfillment trigger failed with status ${response.status}; the cron worker will retry`,
    );
  }
}
