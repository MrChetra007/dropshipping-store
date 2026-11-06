import { processCjWebhook } from "../_shared/cj/webhook.ts";
import { handleOptions, HttpError, json } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";

function cjResponse(
  code: number,
  result: boolean,
  message: string,
): Response {
  return json({ code, result, message }, code === 200 ? 200 : code);
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  if (request.method !== "POST") {
    return cjResponse(405, false, "Method not allowed");
  }

  const rawBody = await request.text();

  try {
    await processCjWebhook(createAdminClient(), rawBody, request.headers);

    return cjResponse(200, true, "success");
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) {
        return cjResponse(401, false, "Invalid signature");
      }

      if (error.status === 400) {
        return cjResponse(400, false, "Invalid payload");
      }
    }

    console.error("CJ webhook error:", error);
    return cjResponse(500, false, "Webhook failed");
  }
});
