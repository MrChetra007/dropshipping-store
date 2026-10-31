import { requireCronSecret } from "../_shared/cron.ts";
import {
  errorResponse,
  handleOptions,
  HttpError,
  json,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { syncTracking } from "../_shared/tracking/sync.ts";

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
    const results = await syncTracking(admin);

    return json({
      checked: results.length,
      updated: results.filter((result) => result.status === "updated").length,
      emailed: results.filter(
        (result) => result.status === "updated" && result.emailed,
      ).length,
      failed: results.filter((result) => result.status === "error").length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
