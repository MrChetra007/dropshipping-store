import { z } from "npm:zod@4";

import { HttpError } from "../_shared/http.ts";
import type { createAdminClient } from "../_shared/supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

const updateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(200_000).nullable(),
    categoryId: z.string().uuid().nullable(),
    status: z.enum(["draft", "active", "archived"]),
    variants: z
      .array(
        z.object({
          id: z.string().uuid(),
          price: z.number().min(0).max(1_000_000),
        }),
      )
      .max(500),
    images: z
      .array(
        z.object({
          id: z.string().uuid(),
          sortOrder: z.number().int().min(0).max(10_000),
        }),
      )
      .max(200),
  })
  .strict();

export type AdminProductListItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  variantCount: number;
  activeVariantCount: number;
  minPrice: number | null;
  image: string | null;
};

export type AdminProductDetail = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    status: string;
    updatedAt: string;
  };
  supplierProductId: string | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    compareAtPrice: number | null;
    stock: number | null;
    weightG: number | null;
    isActive: boolean;
    sortOrder: number;
    costPrice: number | null;
  }>;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    variantId: string | null;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
};

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function listAdminProducts(
  admin: AdminClient,
): Promise<AdminProductListItem[]> {
  const { data: products, error } = await admin
    .from("products")
    .select("id,slug,title,status,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!products || products.length === 0) {
    return [];
  }

  const ids = products.map((product) => product.id);

  const { data: variants, error: variantError } = await admin
    .from("product_variants")
    .select("product_id,price,is_active,sort_order")
    .in("product_id", ids);

  if (variantError) {
    throw new HttpError(500, variantError.message);
  }

  const { data: images, error: imageError } = await admin
    .from("product_images")
    .select("product_id,url,sort_order")
    .in("product_id", ids)
    .order("sort_order", { ascending: true });

  if (imageError) {
    throw new HttpError(500, imageError.message);
  }

  const variantsByProduct = new Map<
    string,
    Array<{ price: number; isActive: boolean }>
  >();
  const imageByProduct = new Map<string, string>();

  for (const variant of variants ?? []) {
    const bucket = variantsByProduct.get(variant.product_id) ?? [];
    bucket.push({
      price: asNumber(variant.price) ?? 0,
      isActive: Boolean(variant.is_active),
    });
    variantsByProduct.set(variant.product_id, bucket);
  }

  for (const image of images ?? []) {
    if (!imageByProduct.has(image.product_id)) {
      imageByProduct.set(image.product_id, image.url);
    }
  }

  return products.map((product) => {
    const productVariants = variantsByProduct.get(product.id) ?? [];
    const prices = productVariants.map((variant) => variant.price);

    return {
      id: product.id,
      slug: product.slug,
      title: product.title,
      status: product.status,
      updatedAt: product.updated_at,
      variantCount: productVariants.length,
      activeVariantCount: productVariants.filter((variant) => variant.isActive)
        .length,
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      image: imageByProduct.get(product.id) ?? null,
    };
  });
}

export async function getAdminProduct(
  admin: AdminClient,
  id: string,
): Promise<AdminProductDetail> {
  if (!z.string().uuid().safeParse(id).success) {
    throw new HttpError(400, "A valid product id is required");
  }

  const { data: product, error } = await admin
    .from("products")
    .select(
      "id,slug,title,description,category_id,status,updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  const { data: variants, error: variantError } = await admin
    .from("product_variants")
    .select(
      "id,sku,title,price,compare_at_price,stock,weight_g,is_active,sort_order",
    )
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  if (variantError) {
    throw new HttpError(500, variantError.message);
  }

  const { data: images, error: imageError } = await admin
    .from("product_images")
    .select("id,url,alt,sort_order,variant_id")
    .eq("product_id", id)
    .order("sort_order", { ascending: true });

  if (imageError) {
    throw new HttpError(500, imageError.message);
  }

  const variantIds = (variants ?? []).map((variant) => variant.id);
  let supplierRows: Array<{
    variant_id: string;
    supplier_product_id: string;
    cost_price: unknown;
  }> = [];

  if (variantIds.length > 0) {
    const { data, error: supplierError } = await admin
      .from("supplier_variants")
      .select("variant_id,supplier_product_id,cost_price")
      .eq("supplier", "cj")
      .in("variant_id", variantIds);

    if (supplierError) {
      throw new HttpError(500, supplierError.message);
    }

    supplierRows = data ?? [];
  }

  const costByVariant = new Map(
    supplierRows.map((row) => [row.variant_id, asNumber(row.cost_price)]),
  );

  const { data: categories, error: categoryError } = await admin
    .from("categories")
    .select("id,name,slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (categoryError) {
    throw new HttpError(500, categoryError.message);
  }

  return {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      categoryId: product.category_id,
      status: product.status,
      updatedAt: product.updated_at,
    },
    supplierProductId: supplierRows[0]?.supplier_product_id ?? null,
    variants: (variants ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      price: asNumber(variant.price) ?? 0,
      compareAtPrice: asNumber(variant.compare_at_price),
      stock: variant.stock,
      weightG: variant.weight_g,
      isActive: Boolean(variant.is_active),
      sortOrder: variant.sort_order,
      costPrice: costByVariant.get(variant.id) ?? null,
    })),
    images: (images ?? []).map((image) => ({
      id: image.id,
      url: image.url,
      alt: image.alt,
      sortOrder: image.sort_order,
      variantId: image.variant_id,
    })),
    categories: categories ?? [],
  };
}

export async function updateAdminProduct(
  admin: AdminClient,
  input: unknown,
): Promise<{ id: string; slug: string; title: string; status: string }> {
  const parsed = updateSchema.safeParse(input);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid product update");
  }

  const payload = parsed.data;
  const variantIds = payload.variants.map((variant) => variant.id);
  const imageIds = payload.images.map((image) => image.id);

  if (new Set(variantIds).size !== variantIds.length) {
    throw new HttpError(400, "Duplicate variant ids");
  }

  if (new Set(imageIds).size !== imageIds.length) {
    throw new HttpError(400, "Duplicate image ids");
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id")
    .eq("id", payload.id)
    .maybeSingle();

  if (productError) {
    throw new HttpError(500, productError.message);
  }

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  if (variantIds.length > 0) {
    const { data: ownedVariants, error: ownedError } = await admin
      .from("product_variants")
      .select("id")
      .eq("product_id", payload.id)
      .in("id", variantIds);

    if (ownedError) {
      throw new HttpError(500, ownedError.message);
    }

    if ((ownedVariants ?? []).length !== variantIds.length) {
      throw new HttpError(400, "A variant does not belong to this product");
    }
  }

  if (imageIds.length > 0) {
    const { data: ownedImages, error: ownedError } = await admin
      .from("product_images")
      .select("id")
      .eq("product_id", payload.id)
      .in("id", imageIds);

    if (ownedError) {
      throw new HttpError(500, ownedError.message);
    }

    if ((ownedImages ?? []).length !== imageIds.length) {
      throw new HttpError(400, "An image does not belong to this product");
    }
  }

  const description =
    payload.description && payload.description.trim()
      ? payload.description
      : null;

  const { data: updated, error } = await admin
    .from("products")
    .update({
      title: payload.title,
      description,
      category_id: payload.categoryId,
      status: payload.status,
    })
    .eq("id", payload.id)
    .select("id,slug,title,status")
    .single();

  if (error || !updated) {
    throw new HttpError(500, error?.message ?? "Could not update product");
  }

  for (const variant of payload.variants) {
    const { error: variantError } = await admin
      .from("product_variants")
      .update({ price: Math.round(variant.price * 100) / 100 })
      .eq("id", variant.id)
      .eq("product_id", payload.id);

    if (variantError) {
      throw new HttpError(500, variantError.message);
    }
  }

  for (const image of payload.images) {
    const { error: imageError } = await admin
      .from("product_images")
      .update({ sort_order: image.sortOrder })
      .eq("id", image.id)
      .eq("product_id", payload.id);

    if (imageError) {
      throw new HttpError(500, imageError.message);
    }
  }

  return updated;
}
