import { firstNumber } from "./numbers.ts";
import type { CjProduct, CjVariant } from "./types.ts";

/**
 * Sum inventory across every CJ warehouse. `null` means CJ did not report
 * inventory at all, which is different from a confirmed zero.
 */
export function variantStock(variant: CjVariant): number | null {
  const inventories = variant.inventories ?? [];

  if (inventories.length === 0) {
    return null;
  }

  return inventories.reduce(
    (total, inventory) => total + (inventory.totalInventory ?? 0),
    0,
  );
}

/**
 * The supplier cost we pay CJ for one unit. Falls back to the product price
 * when CJ omits the variant price (same rule as the importer).
 */
export function variantCost(
  product: CjProduct,
  variant: CjVariant,
): number | null {
  if (variant.variantSellPrice !== null && variant.variantSellPrice > 0) {
    return variant.variantSellPrice;
  }

  const fallback = firstNumber(product.sellPrice);

  return fallback !== null && fallback > 0 ? fallback : null;
}
