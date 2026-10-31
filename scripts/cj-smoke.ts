import {
  CjClient,
  MemoryCjTokenStore,
  getBalance,
  getProduct,
  searchProducts,
} from "../supabase/functions/_shared/cj/index.ts";

function money(value: number | string | null): string {
  if (value === null || value === "") {
    return "n/a";
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? `$${parsed.toFixed(2)}` : `$${value}`;
  }

  return `$${value.toFixed(2)}`;
}

function stockTotal(
  inventories:
    | Array<{ countryCode: string; totalInventory: number | null }>
    | null
    | undefined,
): string {
  if (!inventories || inventories.length === 0) {
    return "no inventory data";
  }

  return inventories
    .map(
      (inventory) =>
        `${inventory.countryCode}: ${inventory.totalInventory ?? "n/a"}`,
    )
    .join(", ");
}

const apiKey = Deno.env.get("CJ_API_KEY")?.trim();

if (!apiKey) {
  console.error("CJ_API_KEY is not set.");
  console.error(
    'PowerShell: $env:CJ_API_KEY="..." ; npm run cj:smoke',
  );
  Deno.exit(1);
}

const client = new CjClient({
  apiKey,
  tokenStore: new MemoryCjTokenStore(),
});

const keyword = Deno.env.get("CJ_SMOKE_KEYWORD")?.trim();

console.log("CJ smoke test");
console.log(`Keyword: ${keyword || "(none)"}`);

const result = await searchProducts(client, {
  keyword,
  page: 1,
  size: 5,
});

console.log(
  `List returned ${result.products.length} product(s) of ${result.totalRecords} total.`,
);

if (result.products.length < 5) {
  throw new Error(
    `Expected at least 5 products, received ${result.products.length}`,
  );
}

const balance = await getBalance(client);
console.log(`CJ balance: ${money(balance.amount)}`);

for (const [index, summary] of result.products.entries()) {
  const product = await getProduct(client, { pid: summary.id });
  const variants = product.variants ?? [];

  console.log("");
  console.log(
    `${index + 1}. ${product.productNameEn ?? summary.nameEn ?? "(no name)"}`,
  );
  console.log(`   pid: ${product.pid}`);
  console.log(`   sku: ${product.productSku ?? summary.sku ?? "n/a"}`);
  console.log(`   price: ${money(product.sellPrice ?? summary.sellPrice)}`);
  console.log(`   variants: ${variants.length}`);
  console.log(`   stock: ${stockTotal(variants[0]?.inventories)}`);

  for (const variant of variants.slice(0, 5)) {
    console.log(
      `   - ${variant.vid} | ${variant.variantSku ?? "no-sku"} | ${
        variant.variantKey ?? "default"
      } | ${money(variant.variantSellPrice ?? product.sellPrice)}`,
    );
  }

  if (variants.length > 5) {
    console.log(`   ... ${variants.length - 5} more variant(s)`);
  }
}

console.log("");
console.log(`Smoke test passed with ${result.products.length} products.`);
