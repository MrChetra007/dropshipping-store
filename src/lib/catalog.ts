import type { SupabaseClient } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { toCents } from "@/lib/utils";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

const DEFAULT_CURRENCY = "USD";
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 48;

export type StoreSettings = {
  name: string;
  currency: string;
  support_email: string | null;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
};

export type ProductCard = {
  id: string;
  slug: string;
  title: string;
  categoryName: string | null;
  categorySlug: string | null;
  priceCents: number | null;
  compareAtCents: number | null;
  imageUrl: string | null;
  imageAlt: string | null;
  inStock: boolean;
  isFeatured: boolean;
};

export type ProductVariant = {
  id: string;
  sku: string;
  title: string;
  options: Record<string, string>;
  priceCents: number;
  compareAtCents: number | null;
  currency: string;
  stock: number | null;
  imageUrl: string | null;
};

export type ProductImage = {
  id: string;
  url: string;
  alt: string | null;
  variantId: string | null;
};

export type ShippingEstimate = {
  name: string;
  countryCode: string;
  amountCents: number;
  freeOverCents: number | null;
  minDays: number | null;
  maxDays: number | null;
};

export type ProductDetail = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    category: CategorySummary | null;
  };
  variants: ProductVariant[];
  images: ProductImage[];
  shippingRates: ShippingEstimate[];
  related: ProductCard[];
};

export type CatalogOptions = {
  q?: string;
  categorySlug?: string;
  categoryId?: string;
  featuredOnly?: boolean;
  excludeId?: string;
  page?: number;
  perPage?: number;
};

export type CatalogResult = {
  products: ProductCard[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
  category: CategorySummary | null;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  category_id: string | null;
  is_featured: boolean;
  created_at: string;
};

function asRecord(value: Json | null | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" || typeof item === "number") {
      result[key] = String(item);
    }
  }

  return result;
}

function mapCategory(row: {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
}): CategorySummary {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "public.store")
    .maybeSingle();

  const value =
    data?.value && typeof data.value === "object" && !Array.isArray(data.value)
      ? (data.value as Record<string, Json>)
      : {};

  return {
    name: typeof value.name === "string" ? value.name : "KinetiCore Labs",
    currency:
      typeof value.currency === "string" ? value.currency : DEFAULT_CURRENCY,
    support_email:
      typeof value.support_email === "string" ? value.support_email : null,
  };
}

export type PaymentInstructions = {
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
  swift: string | null;
  instructions: string | null;
};

export async function getPaymentInstructions(): Promise<PaymentInstructions> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "public.payment_instructions")
    .maybeSingle();

  const value =
    data?.value && typeof data.value === "object" && !Array.isArray(data.value)
      ? (data.value as Record<string, Json>)
      : {};

  const read = (key: string): string | null => {
    const item = value[key];

    return typeof item === "string" && item.trim() ? item.trim() : null;
  };

  return {
    bankName: read("bank_name"),
    accountName: read("account_name"),
    accountNumber: read("account_number"),
    swift: read("swift"),
    instructions: read("instructions"),
  };
}

export async function listCategories(): Promise<CategorySummary[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,slug,name,image_url")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load categories: ${error.message}`);
  }

  return (data ?? []).map(mapCategory);
}

export async function getCategoryBySlug(
  slug: string,
): Promise<CategorySummary | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,slug,name,image_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load category: ${error.message}`);
  }

  return data ? mapCategory(data) : null;
}

async function hydrateProductCards(
  client: Client,
  rows: ProductRow[],
): Promise<ProductCard[]> {
  if (rows.length === 0) {
    return [];
  }

  const ids = rows.map((row) => row.id);
  const categoryIds = [
    ...new Set(
      rows
        .map((row) => row.category_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [variantResult, imageResult, categoryResult] = await Promise.all([
    client
      .from("product_variants")
      .select("product_id,price,compare_at_price,stock,is_active")
      .in("product_id", ids)
      .eq("is_active", true),
    client
      .from("product_images")
      .select("product_id,url,alt,sort_order")
      .in("product_id", ids)
      .order("sort_order", { ascending: true }),
    categoryIds.length > 0
      ? client
          .from("categories")
          .select("id,slug,name,image_url")
          .in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (variantResult.error) {
    throw new Error(`Could not load product prices: ${variantResult.error.message}`);
  }

  if (imageResult.error) {
    throw new Error(`Could not load product images: ${imageResult.error.message}`);
  }

  if (categoryResult.error) {
    throw new Error(
      `Could not load product categories: ${categoryResult.error.message}`,
    );
  }

  const cheapestByProduct = new Map<
    string,
    { priceCents: number; compareAtCents: number | null }
  >();
  const inStockByProduct = new Map<string, boolean>();

  for (const variant of variantResult.data ?? []) {
    const priceCents = toCents(variant.price) ?? 0;
    const current = cheapestByProduct.get(variant.product_id);

    if (!current || priceCents < current.priceCents) {
      cheapestByProduct.set(variant.product_id, {
        priceCents,
        compareAtCents: toCents(variant.compare_at_price),
      });
    }

    if (variant.stock === null || variant.stock > 0) {
      inStockByProduct.set(variant.product_id, true);
    } else if (!inStockByProduct.has(variant.product_id)) {
      inStockByProduct.set(variant.product_id, false);
    }
  }

  const imageByProduct = new Map<
    string,
    { url: string; alt: string | null }
  >();

  for (const image of imageResult.data ?? []) {
    if (!imageByProduct.has(image.product_id)) {
      imageByProduct.set(image.product_id, {
        url: image.url,
        alt: image.alt,
      });
    }
  }

  const categoryById = new Map(
    (categoryResult.data ?? []).map((category) => [
      category.id,
      mapCategory(category),
    ]),
  );

  return rows.map((row) => {
    const price = cheapestByProduct.get(row.id);
    const image = imageByProduct.get(row.id);
    const category = row.category_id
      ? categoryById.get(row.category_id)
      : undefined;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
      priceCents: price?.priceCents ?? null,
      compareAtCents: price?.compareAtCents ?? null,
      imageUrl: image?.url ?? null,
      imageAlt: image?.alt ?? null,
      inStock: inStockByProduct.get(row.id) ?? false,
      isFeatured: row.is_featured,
    };
  });
}

export async function listProductCards(
  options: CatalogOptions = {},
): Promise<CatalogResult> {
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options.perPage ?? DEFAULT_PAGE_SIZE),
  );

  let category: CategorySummary | null = null;
  let categoryId = options.categoryId;

  if (options.categorySlug) {
    category = await getCategoryBySlug(options.categorySlug);

    if (!category) {
      return {
        products: [],
        total: 0,
        page,
        perPage,
        pageCount: 0,
        category: null,
      };
    }

    categoryId = category.id;
  }

  const search = options.q?.trim().slice(0, 100);

  const buildQuery = () => {
    let query = supabase
      .from("products")
      .select("id,slug,title,category_id,is_featured,created_at", {
        count: "exact",
      })
      .eq("status", "active");

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    if (options.featuredOnly) {
      query = query.eq("is_featured", true);
    }

    if (options.excludeId) {
      query = query.neq("id", options.excludeId);
    }

    if (search) {
      query = query.textSearch("search", search, {
        type: "websearch",
        config: "english",
      });
    }

    return query;
  };

  const runPage = (targetPage: number) => {
    const from = (targetPage - 1) * perPage;
    return buildQuery()
      .order("created_at", { ascending: false })
      .range(from, from + perPage - 1);
  };

  let result = await runPage(page);

  if (result.error) {
    throw new Error(`Could not load products: ${result.error.message}`);
  }

  const total = result.count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);

  if (safePage !== page) {
    result = await runPage(safePage);

    if (result.error) {
      throw new Error(`Could not load products: ${result.error.message}`);
    }
  }

  const products = await hydrateProductCards(supabase, result.data ?? []);

  return {
    products,
    total,
    page: safePage,
    perPage,
    pageCount,
    category,
  };
}

export async function getShippingEstimates(): Promise<ShippingEstimate[]> {
  const { data, error } = await supabase
    .from("shipping_rates")
    .select("name,country_code,amount,free_over,min_days,max_days")
    .eq("is_active", true)
    .order("amount", { ascending: true });

  if (error) {
    throw new Error(`Could not load shipping rates: ${error.message}`);
  }

  return (data ?? []).map((rate) => ({
    name: rate.name,
    countryCode: rate.country_code,
    amountCents: toCents(rate.amount) ?? 0,
    freeOverCents: toCents(rate.free_over),
    minDays: rate.min_days,
    maxDays: rate.max_days,
  }));
}

export async function getProductDetail(
  slug: string,
): Promise<ProductDetail | null> {
  const { data: product, error } = await supabase
    .from("products")
    .select("id,slug,title,description,category_id,seo_title,seo_description")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load product: ${error.message}`);
  }

  if (!product) {
    return null;
  }

  const [variantResult, imageResult, shippingRates] = await Promise.all([
    supabase
      .from("product_variants")
      .select(
        "id,sku,title,options,price,compare_at_price,currency,stock,is_active,sort_order",
      )
      .eq("product_id", product.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("product_images")
      .select("id,url,alt,variant_id,sort_order")
      .eq("product_id", product.id)
      .order("sort_order", { ascending: true }),
    getShippingEstimates(),
  ]);

  if (variantResult.error) {
    throw new Error(
      `Could not load product variants: ${variantResult.error.message}`,
    );
  }

  if (imageResult.error) {
    throw new Error(
      `Could not load product images: ${imageResult.error.message}`,
    );
  }

  const categoryResult = product.category_id
    ? await supabase
        .from("categories")
        .select("id,slug,name,image_url")
        .eq("id", product.category_id)
        .eq("is_active", true)
        .maybeSingle()
    : null;

  if (categoryResult?.error) {
    throw new Error(
      `Could not load product category: ${categoryResult.error.message}`,
    );
  }

  const images: ProductImage[] = (imageResult.data ?? []).map((image) => ({
    id: image.id,
    url: image.url,
    alt: image.alt,
    variantId: image.variant_id,
  }));

  const imageByVariant = new Map<string, string>();

  for (const image of images) {
    if (image.variantId && !imageByVariant.has(image.variantId)) {
      imageByVariant.set(image.variantId, image.url);
    }
  }

  const variants: ProductVariant[] = (variantResult.data ?? []).map(
    (variant) => ({
      id: variant.id,
      sku: variant.sku,
      title: variant.title,
      options: asRecord(variant.options),
      priceCents: toCents(variant.price) ?? 0,
      compareAtCents: toCents(variant.compare_at_price),
      currency: variant.currency || DEFAULT_CURRENCY,
      stock: variant.stock,
      imageUrl: imageByVariant.get(variant.id) ?? null,
    }),
  );

  const category = categoryResult?.data
    ? mapCategory(categoryResult.data)
    : null;

  const related = product.category_id
    ? (
        await listProductCards({
          categoryId: product.category_id,
          excludeId: product.id,
          perPage: 4,
        })
      ).products
    : [];

  return {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      description: product.description,
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
      category,
    },
    variants,
    images,
    shippingRates,
    related,
  };
}
