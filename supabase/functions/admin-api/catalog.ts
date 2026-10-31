import { z } from "npm:zod@4";

import {
  createCjClient,
  CjError,
  getProduct,
  searchProducts,
  type CjProduct,
  type CjProductSummary,
} from "../_shared/cj/index.ts";
import { variantCost, variantStock } from "../_shared/cj/inventory.ts";
import { firstNumber } from "../_shared/cj/numbers.ts";
import { HttpError } from "../_shared/http.ts";
import {
  loadPricing,
  pricingSchema,
  sellingPrice,
} from "../_shared/pricing.ts";
import type { createAdminClient } from "../_shared/supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

const searchSchema = z
  .object({
    keyword: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

const pidSchema = z.string().trim().min(1).max(200);

const importSchema = z
  .object({
    pids: z.array(pidSchema).min(1).max(20),
  })
  .strict();

export type AdminCjSearchItem = {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  price: number | null;
  category: string | null;
  inventory: number | null;
};

export type AdminCjVariant = {
  vid: string;
  title: string;
  sku: string | null;
  cost: number | null;
  stock: number | null;
  weightG: number | null;
  image: string | null;
  options: Record<string, string>;
  rawKey: string | null;
};

export type AdminCjProduct = {
  pid: string;
  title: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  images: string[];
  variants: AdminCjVariant[];
};

export type CjImportResult = {
  imported: Array<{
    pid: string;
    productId: string;
    title: string;
    slug: string;
    variantCount: number;
  }>;
  skipped: Array<{
    pid: string;
    productId: string | null;
    title: string | null;
    reason: string;
  }>;
  failed: Array<{ pid: string; error: string }>;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function searchItem(product: CjProductSummary): AdminCjSearchItem {
  return {
    id: product.id,
    title: product.nameEn ?? product.productKeyEn ?? `CJ product ${product.id}`,
    sku: product.sku,
    image: product.bigImage,
    price:
      firstNumber(product.nowPrice) ??
      firstNumber(product.sellPrice) ??
      firstNumber(product.discountPrice),
    category: product.threeCategoryName ?? product.twoCategoryName,
    inventory:
      product.totalVerifiedInventory ??
      product.warehouseInventoryNum ??
      null,
  };
}

function parseJsonStringArray(value: string | null): string[] | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map((item) => String(item));
  } catch {
    return null;
  }
}

function variantOptions(
  variantKey: string | null,
  productKeyEn: string | null,
): Record<string, string> {
  const value = variantKey?.trim();

  if (!value) {
    return {};
  }

  const names = parseJsonStringArray(productKeyEn) ??
    (productKeyEn
      ? productKeyEn
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []);

  const jsonValues = parseJsonStringArray(value);
  const values = jsonValues ?? value.split("-").map((item) => item.trim());

  if (names.length > 0 && names.length === values.length) {
    return Object.fromEntries(names.map((name, index) => [name, values[index]]));
  }

  return { Variant: value };
}

function normalizeProduct(product: CjProduct): AdminCjProduct {
  const images = new Set<string>();

  if (product.bigImage) {
    images.add(product.bigImage);
  }

  for (const image of product.productImageSet) {
    if (image) {
      images.add(image);
    }
  }

  const variants = (product.variants ?? []).map((variant) => {
    const cost = variantCost(product, variant);

    if (variant.variantImage) {
      images.add(variant.variantImage);
    }

    return {
      vid: variant.vid,
      title:
        variant.variantNameEn ??
        variant.variantName ??
        variant.variantSku ??
        "Default",
      sku: variant.variantSku,
      cost,
      stock: variantStock(variant),
      weightG:
        variant.variantWeight === null
          ? null
          : Math.max(0, Math.round(variant.variantWeight)),
      image: variant.variantImage,
      options: variantOptions(variant.variantKey, product.productKeyEn),
      rawKey: variant.variantKey,
    };
  });

  return {
    pid: product.pid,
    title:
      product.productNameEn ??
      product.productKeyEn ??
      `CJ product ${product.pid}`,
    sku: product.productSku,
    description: product.description,
    category: product.categoryName,
    images: [...images],
    variants,
  };
}

function mapCjError(error: unknown): never {
  if (error instanceof CjError) {
    throw new HttpError(502, error.message);
  }

  throw error;
}

export async function searchCatalog(input: unknown) {
  const parsed = searchSchema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid search parameters");
  }

  try {
    const client = createCjClient();
    const result = await searchProducts(client, {
      keyword: parsed.data.keyword,
      page: parsed.data.page,
      size: 20,
    });

    return {
      products: result.products.map(searchItem),
      page: result.page,
      totalPages: result.totalPages,
      totalRecords: result.totalRecords,
    };
  } catch (error) {
    mapCjError(error);
  }
}

export async function getCjProduct(pid: string): Promise<AdminCjProduct> {
  const parsed = pidSchema.safeParse(pid);

  if (!parsed.success) {
    throw new HttpError(400, "A valid CJ product id is required");
  }

  try {
    const client = createCjClient();
    const product = await getProduct(client, { pid: parsed.data });

    return normalizeProduct(product);
  } catch (error) {
    mapCjError(error);
  }
}

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(
  admin: AdminClient,
  title: string,
  pid: string,
): Promise<string> {
  const base = slugify(title) || "cj-product";
  const suffix = pid.toLowerCase();
  let candidate = `${base}-${suffix}`.slice(0, 100);
  let attempt = 1;

  while (attempt <= 20) {
    const { data, error } = await admin
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new HttpError(500, error.message);
    }

    if (!data) {
      return candidate;
    }

    attempt += 1;
    candidate = `${base}-${suffix}-${attempt}`.slice(0, 100);
  }

  throw new HttpError(500, "Could not create a unique product slug");
}

async function findExisting(
  admin: AdminClient,
  pid: string,
): Promise<{ productId: string; title: string } | null> {
  const { data: mapping, error } = await admin
    .from("supplier_variants")
    .select("variant_id")
    .eq("supplier", "cj")
    .eq("supplier_product_id", pid)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!mapping) {
    return null;
  }

  const { data: variant, error: variantError } = await admin
    .from("product_variants")
    .select("product_id")
    .eq("id", mapping.variant_id)
    .maybeSingle();

  if (variantError) {
    throw new HttpError(500, variantError.message);
  }

  if (!variant) {
    return null;
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,title")
    .eq("id", variant.product_id)
    .maybeSingle();

  if (productError) {
    throw new HttpError(500, productError.message);
  }

  return product ? { productId: product.id, title: product.title } : null;
}

async function importOne(
  admin: AdminClient,
  product: AdminCjProduct,
  pricing: z.infer<typeof pricingSchema>,
): Promise<{
  productId: string;
  title: string;
  slug: string;
  variantCount: number;
}> {
  const existing = await findExisting(admin, product.pid);

  if (existing) {
    throw new HttpError(409, `Already imported as "${existing.title}"`);
  }

  const pricedVariants = product.variants.filter(
    (variant) => variant.cost !== null,
  );

  if (pricedVariants.length === 0) {
    throw new HttpError(422, "CJ product has no priced variants to import");
  }

  const slug = await uniqueSlug(admin, product.title, product.pid);

  const { data: created, error: createError } = await admin
    .from("products")
    .insert({
      slug,
      title: product.title,
      description: product.description,
      status: "draft",
      tags: [],
    })
    .select("id,title,slug")
    .single();

  if (createError || !created) {
    throw new HttpError(500, createError?.message ?? "Could not create product");
  }

  try {
    const variantRows = pricedVariants.map((variant, index) => ({
      product_id: created.id,
      sku: `CJ-${variant.vid}`,
      title: variant.title,
      options: variant.options,
      price: sellingPrice(
        variant.cost ?? 0,
        pricing.multiplier,
        pricing.round_to,
      ),
      currency: "USD",
      stock: variant.stock,
      weight_g: variant.weightG,
      is_active: true,
      sort_order: index,
    }));

    const { data: insertedVariants, error: variantError } = await admin
      .from("product_variants")
      .insert(variantRows)
      .select("id,sku");

    if (variantError || !insertedVariants) {
      throw new HttpError(
        500,
        variantError?.message ?? "Could not create product variants",
      );
    }

    const variantIdBySku = new Map(
      insertedVariants.map((variant) => [variant.sku, variant.id]),
    );

    const supplierRows = pricedVariants.map((variant, index) => {
      const row = variantRows[index];
      const variantId = variantIdBySku.get(row.sku);

      if (!variantId) {
        throw new HttpError(500, "Could not match an imported variant");
      }

      return {
        variant_id: variantId,
        supplier: "cj",
        supplier_product_id: product.pid,
        supplier_variant_id: variant.vid,
        supplier_sku: variant.sku,
        cost_price: roundMoney(variant.cost ?? 0),
        cost_currency: "USD",
        last_synced_at: new Date().toISOString(),
        raw: {
          variantKey: variant.rawKey,
          variantName: variant.title,
          variantSku: variant.sku,
          variantImage: variant.image,
          options: variant.options,
        },
      };
    });

    const { error: supplierError } = await admin
      .from("supplier_variants")
      .insert(supplierRows);

    if (supplierError) {
      throw new HttpError(500, supplierError.message);
    }

    const imageRows: Array<{
      product_id: string;
      variant_id: string | null;
      url: string;
      alt: string;
      sort_order: number;
    }> = [];
    const seenImages = new Set<string>();
    let sortOrder = 0;

    for (const url of product.images) {
      if (!url || seenImages.has(url)) {
        continue;
      }

      seenImages.add(url);
      imageRows.push({
        product_id: created.id,
        variant_id: null,
        url,
        alt: product.title,
        sort_order: sortOrder,
      });
      sortOrder += 1;
    }

    for (const variant of pricedVariants) {
      if (!variant.image || seenImages.has(variant.image)) {
        continue;
      }

      const variantId = variantIdBySku.get(`CJ-${variant.vid}`);

      if (!variantId) {
        continue;
      }

      seenImages.add(variant.image);
      imageRows.push({
        product_id: created.id,
        variant_id: variantId,
        url: variant.image,
        alt: variant.title,
        sort_order: sortOrder,
      });
      sortOrder += 1;
    }

    if (imageRows.length > 0) {
      const { error: imageError } = await admin
        .from("product_images")
        .insert(imageRows);

      if (imageError) {
        throw new HttpError(500, imageError.message);
      }
    }

    return {
      productId: created.id,
      title: created.title,
      slug: created.slug,
      variantCount: pricedVariants.length,
    };
  } catch (error) {
    await admin.from("products").delete().eq("id", created.id);

    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(
      500,
      error instanceof Error ? error.message : "Import failed",
    );
  }
}

export async function importCatalog(
  admin: AdminClient,
  input: unknown,
): Promise<CjImportResult> {
  const parsed = importSchema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, "Select between 1 and 20 CJ products to import");
  }

  const pids = [...new Set(parsed.data.pids)];
  const result: CjImportResult = {
    imported: [],
    skipped: [],
    failed: [],
  };
  const client = createCjClient();
  const pricing = await loadPricing(admin);

  for (const pid of pids) {
    try {
      const existing = await findExisting(admin, pid);

      if (existing) {
        result.skipped.push({
          pid,
          productId: existing.productId,
          title: existing.title,
          reason: "Already imported",
        });
        continue;
      }

      const product = normalizeProduct(
        await getProduct(client, { pid }),
      );
      const imported = await importOne(admin, product, pricing);

      result.imported.push({ pid, ...imported });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      const status = error instanceof HttpError ? error.status : 500;

      if (status === 409) {
        result.skipped.push({
          pid,
          productId: null,
          title: null,
          reason: message,
        });
      } else {
        result.failed.push({ pid, error: message });
      }
    }
  }

  return result;
}
