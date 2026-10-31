import { z } from "npm:zod@4";

import type { CjClient } from "./client.ts";
import { cjTrackingSchema, type CjTracking } from "./types.ts";

const trackNumbersSchema = z.array(z.string().trim().min(1).max(200)).min(1);

export async function getTrackingInfo(
  client: CjClient,
  trackNumbers: string[],
): Promise<CjTracking[]> {
  const numbers = trackNumbersSchema.parse(trackNumbers);

  return client.request("/logistic/trackInfo", {
    method: "GET",
    query: { trackNumber: numbers },
    schema: z.array(cjTrackingSchema),
  });
}
