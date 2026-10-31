import { CjApiError } from "../cj/errors.ts";
import { createCjClient } from "../cj/factory.ts";
import { variantCost, variantStock } from "../cj/inventory.ts";
import { getProduct } from "../cj/products.ts";
import type { CjProduct } from "../cj/types.ts";
import {
  loadMarginGuard,
  loadPricing,
  sellingPrice,
  type MarginGuard,
  type PricingRules,
} from "../pricing.ts";
import type { createAdminClient } from "../supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * One CJ request per product, and the client is rate limited to 1 req/s.
 * Keeping a run well under the edge function timeout leaves room for retries.
 * Products are rotated by `last_synced_at`, so a larger catalog is covered
 * over several cron runs.
 */
const MAX_PRODUCTS_PER_RUN = 40;
const MARGIN_REASON_PREFIX = "Margin ";
const CJ_PRODUCT_GONE_CODES = new Set([1602000, 1602001, 1602002, 1602003]);

type VariantRow = {
  id: string;
  price: number | string;
  stock: number | null;
  is_active: boolean;
  auto_disabled_at: string | null;
  needs_review: boolean;
  review_reason: string | null;
};

type SupplierVariantRow = {
  variant_id: string;
  supplier_product_id: string;
  supplier_variant_id: string;
  cost_price: number | string;
  last_synced_at: string | null;
  product_variants: VariantRow | VariantRow[] | null;
};

export type StockSyncProductResult = {
  pid: string;
  variants: number;
  updated: number;
  disabled: number;
  enabled: number;
  flagged: number;
  repriced: number;
  error: string | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function marginPercent(price: number, cost: number): number {
  return ((price - cost) / price) * 100;
}

function isProductGoneError(error: unknown): boolean {
  return error instanceof CjApiError && CJ_PRODUCT_GONE_CODES.has(error.code);
}

async function loadSupplierVariants(
  admin: AdminClient,
): Promise<SupplierVariantRow[]> {
  const pageSize = 1000;
  const rows: SupplierVariantRow[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("supplier_variants")
      .select(
        "variant_id,supplier_product_id,supplier_variant_id,cost_price,last_synced_at," +
          "product_variants(id,price,stock,is_active,auto_disabled_at,needs_review,review_reason)",
      )
      .eq("supplier", "cj")
      .order("variant_id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Could not load supplier variants: ${error.message}`);
    }

    const page = (data ?? []) as unknown as SupplierVariantRow[];
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return rows;
}

function groupByProduct(
  rows: SupplierVariantRow[],
): Map<string, SupplierVariantRow[]> {
  const groups = new Map<string, SupplierVariantRow[]>();

  for (const row of rows) {
    const bucket = groups.get(row.supplier_product_id) ?? [];
    bucket.push(row);
    groups.set(row.supplier_product_id, bucket);
  }

  return groups;
}

function oldestSyncTime(rows: SupplierVariantRow[]): number {
  let oldest = Number.POSITIVE_INFINITY;

  for (const row of rows) {
    const time = row.last_synced_at ? Date.parse(row.last_synced_at) : 0;
    oldest = Math.min(oldest, Number.isFinite(time) ? time : 0);
  }

  return Number.isFinite(oldest) ? oldest : 0;
}

async function syncOneProduct(
  admin: AdminClient,
  client: ReturnType<typeof createCjClient>,
  pid: string,
  rows: SupplierVariantRow[],
  pricing: PricingRules,
  marginGuard: MarginGuard,
): Promise<StockSyncProductResult> {
  const result: StockSyncProductResult = {
    pid,
    variants: 0,
    updated: 0,
    disabled: 0,
    enabled: 0,
    flagged: 0,
    repriced: 0,
    error: null,
  };

  let cjProduct: CjProduct | null = null;
  let goneReason: string | null = null;

  try {
    cjProduct = await getProduct(client, { pid });
  } catch (error) {
    if (isProductGoneError(error)) {
      goneReason = "CJ reports this product as removed or off shelf";
    } else {
      result.error =
        error instanceof Error ? error.message : "Unknown CJ error";
      return result;
    }
  }

  const cjVariants = new Map(
    (cjProduct?.variants ?? []).map((variant) => [variant.vid, variant]),
  );
  const syncedAt = new Date().toISOString();

  for (const row of rows) {
    const variant = firstRelation(row.product_variants);

    if (!variant) {
      continue;
    }

    result.variants += 1;

    const cjVariant = cjProduct
      ? cjVariants.get(row.supplier_variant_id) ?? null
      : null;
    const stock = cjVariant ? variantStock(cjVariant) : null;
    const cost =
      cjProduct && cjVariant ? variantCost(cjProduct, cjVariant) : null;
    const previousCost = toNumber(row.cost_price);
    const currentPrice = toNumber(variant.price) ?? 0;
    const costCents = cost === null ? null : Math.round(cost * 100);
    const previousCostCents =
      previousCost === null ? null : Math.round(previousCost * 100);
    const currentPriceCents = Math.round(currentPrice * 100);
    const unavailable =
      goneReason !== null ||
      (cjProduct !== null && cjVariant === null) ||
      stock === 0;

    let priceCents = currentPriceCents;
    let needsReview = Boolean(variant.needs_review);
    let reviewReason = variant.review_reason;
    let isActive = Boolean(variant.is_active);
    let autoDisabledAt = variant.auto_disabled_at;
    let changed = stock !== variant.stock;

    if (costCents !== null) {
      if (costCents !== previousCostCents) {
        changed = true;
      }

      if (priceCents > 0) {
        const unitCost = costCents / 100;
        let margin = marginPercent(priceCents / 100, unitCost);

        if (margin < marginGuard.min_margin_percent) {
          if (marginGuard.auto_reprice) {
            const repricedCents = Math.round(
              sellingPrice(
                unitCost,
                pricing.multiplier,
                pricing.round_to,
              ) * 100,
            );

            if (repricedCents !== priceCents) {
              priceCents = repricedCents;
              margin = marginPercent(priceCents / 100, unitCost);
              changed = true;
            }
          }

          if (margin < marginGuard.min_margin_percent) {
            needsReview = true;
            reviewReason =
              `${MARGIN_REASON_PREFIX}${margin.toFixed(0)}% is below ` +
              `${marginGuard.min_margin_percent}% (cost $${unitCost.toFixed(2)})`;
          } else {
            needsReview = false;
            reviewReason = null;
          }
        } else if (
          !reviewReason ||
          reviewReason.startsWith(MARGIN_REASON_PREFIX)
        ) {
          needsReview = false;
          reviewReason = null;
        }
      }
    }

    if (unavailable) {
      if (isActive) {
        isActive = false;
        autoDisabledAt = syncedAt;
        result.disabled += 1;
        changed = true;
      }
    } else if (autoDisabledAt && stock !== null && stock > 0) {
      // Only re-enable variants this worker disabled, and only when CJ reports
      // known stock again. A variant the owner turned off manually stays off.
      isActive = true;
      autoDisabledAt = null;
      result.enabled += 1;
      changed = true;
    }

    if (needsReview !== Boolean(variant.needs_review)) {
      if (needsReview) {
        result.flagged += 1;
      }

      changed = true;
    }

    if (reviewReason !== variant.review_reason) {
      changed = true;
    }

    if (priceCents !== currentPriceCents) {
      result.repriced += 1;
    }

    const variantUpdate: Record<string, unknown> = { stock };

    if (priceCents !== currentPriceCents) {
      variantUpdate.price = priceCents / 100;
    }

    if (isActive !== Boolean(variant.is_active)) {
      variantUpdate.is_active = isActive;
    }

    if (autoDisabledAt !== variant.auto_disabled_at) {
      variantUpdate.auto_disabled_at = autoDisabledAt;
    }

    if (needsReview !== Boolean(variant.needs_review)) {
      variantUpdate.needs_review = needsReview;
    }

    if (reviewReason !== variant.review_reason) {
      variantUpdate.review_reason = reviewReason;
    }

    const { error: variantError } = await admin
      .from("product_variants")
      .update(variantUpdate)
      .eq("id", variant.id);

    if (variantError) {
      throw new Error(
        `Could not update variant ${variant.id}: ${variantError.message}`,
      );
    }

    const supplierUpdate: Record<string, unknown> = {
      last_synced_at: syncedAt,
    };

    if (costCents !== null && costCents !== previousCostCents) {
      supplierUpdate.cost_price = costCents / 100;
    }

    const { error: supplierError } = await admin
      .from("supplier_variants")
      .update(supplierUpdate)
      .eq("variant_id", row.variant_id);

    if (supplierError) {
      throw new Error(
        `Could not update supplier cost for ${row.variant_id}: ${supplierError.message}`,
      );
    }

    if (changed) {
      result.updated += 1;
    }
  }

  if (goneReason) {
    console.warn(`Stock sync: ${goneReason} (${pid})`);
  }

  return result;
}

/**
 * Refresh stock and supplier cost from CJ for the products that have waited
 * longest since their last sync. Called by `/api/cron/stock` every six hours.
 */
export async function syncStock(
  admin: AdminClient,
  limit = MAX_PRODUCTS_PER_RUN,
): Promise<StockSyncProductResult[]> {
  const [pricing, marginGuard] = await Promise.all([
    loadPricing(admin),
    loadMarginGuard(admin),
  ]);
  const rows = await loadSupplierVariants(admin);

  if (rows.length === 0) {
    return [];
  }

  const groups = [...groupByProduct(rows).entries()]
    .map(([pid, productRows]) => ({
      pid,
      rows: productRows,
      oldest: oldestSyncTime(productRows),
    }))
    .sort((a, b) => a.oldest - b.oldest)
    .slice(0, Math.max(1, limit));

  const client = createCjClient();
  const results: StockSyncProductResult[] = [];

  for (const group of groups) {
    try {
      results.push(
        await syncOneProduct(
          admin,
          client,
          group.pid,
          group.rows,
          pricing,
          marginGuard,
        ),
      );
    } catch (error) {
      results.push({
        pid: group.pid,
        variants: group.rows.length,
        updated: 0,
        disabled: 0,
        enabled: 0,
        flagged: 0,
        repriced: 0,
        error: error instanceof Error ? error.message : "Unknown sync error",
      });
    }
  }

  return results;
}
