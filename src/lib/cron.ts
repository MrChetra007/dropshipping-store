import "server-only";

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
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when the env var is
 * set. Manual callers must send the same header.
 */
export function isCronAuthorized(request: Request, secret: string): boolean {
  return timingSafeEqual(
    request.headers.get("authorization") ?? "",
    `Bearer ${secret}`,
  );
}
