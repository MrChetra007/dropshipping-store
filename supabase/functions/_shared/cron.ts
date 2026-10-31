import { HttpError } from "./http.ts";

function timingSafeEqual(received: string, expected: string): boolean {
  if (received.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

/**
 * Cron/worker functions are deployed with `verify_jwt = false`, so they must
 * authenticate the caller themselves. The shared secret is the same value the
 * Next.js cron routes and the payment webhook's fulfillment kick send.
 */
export function requireCronSecret(request: Request): void {
  const secret = Deno.env.get("CRON_SECRET")?.trim();

  if (!secret) {
    throw new HttpError(500, "CRON_SECRET is not configured");
  }

  const authorization = request.headers.get("Authorization") ?? "";

  if (!timingSafeEqual(authorization, `Bearer ${secret}`)) {
    throw new HttpError(401, "Unauthorized");
  }
}
