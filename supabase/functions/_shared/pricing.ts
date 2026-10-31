import { z } from "npm:zod@4";

import { HttpError } from "./http.ts";
import type { createAdminClient } from "./supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export const pricingSchema = z
  .object({
    multiplier: z.number().positive().max(100),
    round_to: z.number().min(0).max(0.99),
  })
  .strict();

export type PricingRules = z.infer<typeof pricingSchema>;

/**
 * Margin guard used by the stock/cost sync. `auto_reprice` is off by default:
 * a supplier cost increase flags the variant for review instead of silently
 * changing the customer-facing price.
 */
export const marginGuardSchema = z
  .object({
    min_margin_percent: z.number().min(0).max(100),
    auto_reprice: z.boolean(),
  })
  .strict();

export type MarginGuard = z.infer<typeof marginGuardSchema>;

export const DEFAULT_MARGIN_GUARD: MarginGuard = {
  min_margin_percent: 20,
  auto_reprice: false,
};

/**
 * Round a selling price up so it ends in the configured cents value.
 * Example: cost 10, multiplier 2.5, round_to 0.99 -> 24.99.
 */
export function sellingPrice(
  cost: number,
  multiplier: number,
  roundTo: number,
): number {
  const rawCents = Math.round(cost * 100 * multiplier);
  const roundCents = Math.round(roundTo * 100);

  if (roundCents <= 0) {
    return rawCents / 100;
  }

  const roundedCents =
    Math.ceil((rawCents - roundCents) / 100) * 100 + roundCents;

  return Math.max(roundCents, roundedCents) / 100;
}

export async function loadPricing(admin: AdminClient): Promise<PricingRules> {
  const { data, error } = await admin
    .from("settings")
    .select("value")
    .eq("key", "pricing.markup")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  const parsed = pricingSchema.safeParse(data?.value);

  if (!parsed.success) {
    throw new HttpError(500, "settings.pricing.markup is missing or invalid");
  }

  return parsed.data;
}

export async function loadMarginGuard(
  admin: AdminClient,
): Promise<MarginGuard> {
  const { data, error } = await admin
    .from("settings")
    .select("value")
    .eq("key", "pricing.margin_guard")
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  const parsed = marginGuardSchema.safeParse(data?.value);

  if (!parsed.success) {
    console.warn(
      "settings.pricing.margin_guard is missing or invalid; using defaults",
    );
    return DEFAULT_MARGIN_GUARD;
  }

  return parsed.data;
}
