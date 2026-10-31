import { requireCronSecret } from "../_shared/cron.ts";
import {
  errorResponse,
  handleOptions,
  HttpError,
  json,
} from "../_shared/http.ts";
import { syncStock } from "../_shared/stock/sync.ts";
import { createAdminClient } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    requireCronSecret(request);

    if (request.method !== "POST" && request.method !== "GET") {
      throw new HttpError(405, "Method not allowed");
    }

    const admin = createAdminClient();
    const results = await syncStock(admin);

    return json({
      checked: results.length,
      updated: results.reduce((total, result) => total + result.updated, 0),
      disabled: results.reduce((total, result) => total + result.disabled, 0),
      enabled: results.reduce((total, result) => total + result.enabled, 0),
      flagged: results.reduce((total, result) => total + result.flagged, 0),
      repriced: results.reduce((total, result) => total + result.repriced, 0),
      failed: results.filter((result) => result.error !== null).length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
