"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { callAdminApi, EdgeFunctionError } from "@/lib/supabase/functions";

type CjImportResult = {
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

export type ImportProductsState = {
  error?: string;
  result?: CjImportResult;
};

export type UpdateProductState = {
  error?: string;
  message?: string;
};

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

function errorMessage(error: unknown): string {
  if (error instanceof EdgeFunctionError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Something went wrong.";
}

function stringEntries(values: FormDataEntryValue[]): string[] {
  return values.filter((value): value is string => typeof value === "string");
}

export async function importCjProducts(
  _previousState: ImportProductsState,
  formData: FormData,
): Promise<ImportProductsState> {
  await requireAdmin();

  const parsed = importSchema.safeParse([
    ...new Set(stringEntries(formData.getAll("pids"))),
  ]);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid selection." };
  }

  try {
    const result = await callAdminApi<CjImportResult>("products.import", {
      method: "POST",
      body: { pids: parsed.data },
    });

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/import");
    revalidatePath("/admin");
    revalidatePath("/products");
    revalidatePath("/");

    return { result };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function updateProduct(
  _previousState: UpdateProductState,
  formData: FormData,
): Promise<UpdateProductState> {
  await requireAdmin();

  const variantIds = stringEntries(formData.getAll("variant_id"));
  const imageIds = stringEntries(formData.getAll("image_id"));
  const categoryValue = formData.get("categoryId");

  const parsed = updateSchema.safeParse({
    id: formData.get("productId"),
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    categoryId:
      typeof categoryValue === "string" && categoryValue.trim()
        ? categoryValue.trim()
        : null,
    status: formData.get("status"),
    variants: variantIds.map((id) => ({
      id,
      price: Number(formData.get(`variant_price_${id}`)),
    })),
    images: imageIds.map((id) => ({
      id,
      sortOrder: Number(formData.get(`image_order_${id}`)),
    })),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid product." };
  }

  try {
    await callAdminApi<{
      id: string;
      slug: string;
      title: string;
      status: string;
    }>("products.update", {
      method: "POST",
      body: parsed.data,
    });

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${parsed.data.id}`);
    revalidatePath("/products");
    revalidatePath("/");

    return { message: "Product saved." };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
