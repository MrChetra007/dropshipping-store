export function safeNext(
  value: string | null | undefined,
  fallback = "/account",
): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}
