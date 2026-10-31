export function toCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.round(amount * 100);
}

export function centsToAmount(cents: number): number {
  return Math.round(cents) / 100;
}

export function clampCents(value: number): number {
  return Math.max(0, Math.round(value));
}
