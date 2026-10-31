import { z } from "npm:zod@4";

import { requireCronSecret } from "../_shared/cron.ts";
import {
  errorResponse,
  handleOptions,
  HttpError,
  json,
} from "../_shared/http.ts";
import {
  processSupplierOrder,
  type FulfillmentOutcome,
  type SupplierOrderRow,
} from "../_shared/fulfillment/process.ts";
import { createAdminClient } from "../_shared/supabase.ts";

const requestSchema = z
  .object({
    supplierOrderId: z.string().uuid().optional(),
  })
  .strict();

type ClaimedResult = FulfillmentOutcome & {
  rowId: string;
  orderId: string;
};

async function readBody(
  request: Request,
): Promise<z.infer<typeof requestSchema>> {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }

  const parsed = requestSchema.safeParse(payload);

  if (!parsed.success) {
    throw new HttpError(400, "Invalid request body");
  }

  return parsed.data;
}

async function claimOne(
  admin: ReturnType<typeof createAdminClient>,
  supplierOrderId: string,
): Promise<SupplierOrderRow | null> {
  const { data, error } = await admin.rpc("claim_supplier_order", {
    p_id: supplierOrderId,
  });

  if (error) {
    throw new HttpError(
      500,
      `Could not claim supplier order: ${error.message}`,
    );
  }

  const raw = data as SupplierOrderRow | SupplierOrderRow[] | null;

  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }

  return raw ?? null;
}

async function claimBatch(
  admin: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<SupplierOrderRow[]> {
  const { data, error } = await admin.rpc("claim_supplier_orders", {
    p_limit: limit,
  });

  if (error) {
    throw new HttpError(
      500,
      `Could not claim supplier orders: ${error.message}`,
    );
  }

  const raw = data as SupplierOrderRow[] | SupplierOrderRow | null;

  if (Array.isArray(raw)) {
    return raw;
  }

  return raw ? [raw] : [];
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    requireCronSecret(request);

    if (request.method !== "POST") {
      throw new HttpError(405, "Method not allowed");
    }

    const { supplierOrderId } = await readBody(request);
    const admin = createAdminClient();
    let rows: SupplierOrderRow[];

    if (supplierOrderId) {
      const row = await claimOne(admin, supplierOrderId);
      rows = row ? [row] : [];
    } else {
      rows = await claimBatch(admin, 5);
    }

    const results: ClaimedResult[] = [];

    for (const row of rows) {
      try {
        const outcome = await processSupplierOrder(admin, row);

        results.push({
          ...outcome,
          rowId: row.id,
          orderId: row.order_id,
        });
      } catch (error) {
        console.error(
          `Fulfillment failed for supplier order ${row.id}:`,
          error,
        );
        results.push({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          rowId: row.id,
          orderId: row.order_id,
        });
      }
    }

    return json({
      claimed: rows.length,
      submitted: results.filter((result) => result.status === "submitted")
        .length,
      retried: results.filter((result) => result.status === "retry").length,
      failed: results.filter((result) => result.status === "failed").length,
      skipped: results.filter((result) => result.status === "skipped").length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
