/**
 * CJ returns many numeric fields as strings, and some (prices, weights) can be
 * ranges such as "2.97-5.99". This takes the first usable number.
 */
export function firstNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const match = value.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : null;
}
