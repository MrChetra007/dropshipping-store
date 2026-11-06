import { z } from "zod";

import { callAdminApi } from "@/lib/functions";
import type {
  AdminImportResult,
  AdminOrderResponse,
  AdminOrdersResponse,
  AdminProductDetail,
  AdminProductsResponse,
  AdminSession,
  CjProductDetail,
  CjSearchResponse,
  MarkPaidStatus,
} from "@/types/admin";

const importSchema = z
  .array(z.string().trim().min(1).max(200))
  .min(1, "Select at least one product.")
  .max(20, "Import at most 20 products at a time.");

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().max(200_000),
  categoryId: z.string().uuid().nullable(),
  status: z.enum(["draft", "active", "archived"]),
  variants: z
    .array(
      z.object({
        id: z.string().uuid(),
        price: z
          .number()
          .min(0, "Price cannot be negative.")
          .max(1_000_000, "Price is too large."),
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
});

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export async function getAdminSession(): Promise<AdminSession> {
  return callAdminApi<AdminSession>("session");
}

export async function listAdminProducts(): Promise<AdminProductsResponse> {
  return callAdminApi<AdminProductsResponse>("products.list");
}

export async function getAdminProduct(id: string): Promise<AdminProductDetail> {
  return callAdminApi<AdminProductDetail>("products.get", { query: { id } });
}

export async function listAdminOrders(): Promise<AdminOrdersResponse> {
  return callAdminApi<AdminOrdersResponse>("orders.list");
}

export async function getAdminOrder(id: string): Promise<AdminOrderResponse> {
  return callAdminApi<AdminOrderResponse>("orders.get", { query: { id } });
}

export async function searchCjProducts(
  keyword: string,
  page: number,
): Promise<CjSearchResponse> {
  return callAdminApi<CjSearchResponse>("cj.search", {
    query: { keyword, page },
  });
}

export async function getCjProduct(pid: string): Promise<CjProductDetail> {
  return callAdminApi<CjProductDetail>("cj.product", { query: { pid } });
}

export async function importCjProducts(
  rawPids: unknown[],
): Promise<AdminImportResult> {
  const pids = rawPids.filter(
    (pid): pid is string => typeof pid === "string" && pid.length > 0,
  );
  const parsed = importSchema.safeParse([...new Set(pids)]);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid selection.");
  }

  return callAdminApi<AdminImportResult>("products.import", {
    method: "POST",
    body: { pids: parsed.data },
  });
}

export type UpdateProductInput = {
  id: string;
  title: string;
  description: string;
  categoryId: string | null;
  status: string;
  variants: Array<{ id: string; price: number }>;
  images: Array<{ id: string; sortOrder: number }>;
};

export async function updateProduct(
  input: UpdateProductInput,
): Promise<{ id: string; slug: string; title: string; status: string }> {
  const parsed = updateSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid product.");
  }

  return callAdminApi<{
    id: string;
    slug: string;
    title: string;
    status: string;
  }>("products.update", {
    method: "POST",
    body: parsed.data,
  });
}

export async function markOrderPaid(input: {
  orderId: string;
  reference: string | null;
}): Promise<MarkPaidStatus> {
  const result = await callAdminApi<{ status: string }>("orders.markPaid", {
    method: "POST",
    body: { orderId: input.orderId, reference: input.reference },
  });

  return result.status as MarkPaidStatus;
}

export async function retryCjOrder(orderId: string): Promise<void> {
  await callAdminApi("orders.retryFulfillment", {
    method: "POST",
    body: { orderId },
  });
}
