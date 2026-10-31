import { z } from "npm:zod@4";

import type { CjClient } from "./client.ts";
import {
  cjProductListDataSchema,
  cjProductSchema,
  type CjProduct,
  type CjProductSummary,
} from "./types.ts";

export type CjProductFeature =
  | "enable_description"
  | "enable_category"
  | "enable_combine"
  | "enable_video";

export type CjSearchProductsInput = {
  keyword?: string;
  page?: number;
  size?: number;
  categoryId?: string;
  countryCode?: string;
  sort?: "asc" | "desc";
  orderBy?: 0 | 1 | 2 | 3 | 4;
  features?: CjProductFeature[];
};

export type CjSearchProductsResult = {
  products: CjProductSummary[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  relatedCategories: Array<{
    categoryId: string | null;
    categoryName: string | null;
  }>;
};

export type CjProductLookup =
  | { pid: string; productSku?: never; variantSku?: never }
  | { pid?: never; productSku: string; variantSku?: never }
  | { pid?: never; productSku?: never; variantSku: string };

const searchProductsSchema = z
  .object({
    keyword: z.string().trim().max(200).optional(),
    page: z.number().int().min(1).max(1000).optional(),
    size: z.number().int().min(1).max(100).optional(),
    categoryId: z.string().trim().min(1).max(200).optional(),
    countryCode: z.string().length(2).optional(),
    sort: z.enum(["asc", "desc"]).optional(),
    orderBy: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]).optional(),
    features: z
      .array(
        z.enum([
          "enable_description",
          "enable_category",
          "enable_combine",
          "enable_video",
        ]),
      )
      .optional(),
  })
  .strict();

const productLookupSchema = z
  .object({
    pid: z.string().trim().min(1).max(200).optional(),
    productSku: z.string().trim().min(1).max(200).optional(),
    variantSku: z.string().trim().min(1).max(200).optional(),
    countryCode: z.string().length(2).optional(),
  })
  .strict()
  .refine(
    (value) =>
      [value.pid, value.productSku, value.variantSku].filter(Boolean).length ===
      1,
    "Provide exactly one of pid, productSku, or variantSku",
  );

export async function searchProducts(
  client: CjClient,
  input: CjSearchProductsInput = {},
): Promise<CjSearchProductsResult> {
  const parameters = searchProductsSchema.parse(input);
  const data = await client.request("/product/listV2", {
    method: "GET",
    query: {
      keyWord: parameters.keyword,
      page: parameters.page,
      size: parameters.size,
      categoryId: parameters.categoryId,
      countryCode: parameters.countryCode,
      sort: parameters.sort,
      orderBy: parameters.orderBy,
      features: parameters.features,
    },
    schema: cjProductListDataSchema,
  });

  const content = data.content ?? [];
  const products = content.flatMap((item) => item.productList ?? []);
  const relatedCategories = content.flatMap(
    (item) => item.relatedCategoryList ?? [],
  );

  return {
    products,
    page: data.pageNumber ?? parameters.page ?? 1,
    pageSize: data.pageSize ?? parameters.size ?? products.length,
    totalRecords: data.totalRecords ?? products.length,
    totalPages: data.totalPages ?? 0,
    relatedCategories,
  };
}

export async function getProduct(
  client: CjClient,
  lookup: CjProductLookup & { countryCode?: string },
): Promise<CjProduct> {
  const parameters = productLookupSchema.parse(lookup);

  return client.request("/product/query", {
    method: "GET",
    query: {
      pid: parameters.pid,
      productSku: parameters.productSku,
      variantSku: parameters.variantSku,
      countryCode: parameters.countryCode,
    },
    schema: cjProductSchema,
  });
}
