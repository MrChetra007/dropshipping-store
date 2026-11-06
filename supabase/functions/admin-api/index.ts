import { requireAdmin } from "../_shared/auth.ts";
import {
  triggerFulfillment,
  waitUntil,
} from "../_shared/fulfillment-trigger.ts";
import {
  errorResponse,
  handleOptions,
  HttpError,
  json,
} from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import { getCjProduct, importCatalog, searchCatalog } from "./catalog.ts";
import {
  getAdminOrder,
  listAdminOrders,
  markOrderPaidManually,
  retrySupplierOrder,
} from "./orders.ts";
import {
  getAdminProduct,
  listAdminProducts,
  updateAdminProduct,
} from "./products.ts";

type SettingPayload = {
  key?: unknown;
  value?: unknown;
};

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);
  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const user = await requireAdmin(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const admin = createAdminClient();

    if (request.method === "GET" && action === "session") {
      return json({ user });
    }

    if (request.method === "GET" && action === "cj.search") {
      return json(
        await searchCatalog({
          keyword: url.searchParams.get("keyword") ?? undefined,
          page: url.searchParams.get("page") ?? 1,
        }),
      );
    }

    if (request.method === "GET" && action === "cj.product") {
      return json(
        await getCjProduct(url.searchParams.get("pid") ?? ""),
      );
    }

    if (request.method === "GET" && action === "products.list") {
      return json({ products: await listAdminProducts(admin) });
    }

    if (request.method === "GET" && action === "products.get") {
      return json(
        await getAdminProduct(admin, url.searchParams.get("id") ?? ""),
      );
    }

    if (request.method === "POST" && action === "products.import") {
      return json(await importCatalog(admin, await readJson(request)));
    }

    if (request.method === "POST" && action === "products.update") {
      return json(
        await updateAdminProduct(admin, await readJson(request)),
      );
    }

    if (request.method === "GET" && action === "orders.list") {
      return json({ orders: await listAdminOrders(admin) });
    }

    if (request.method === "GET" && action === "orders.get") {
      return json(
        await getAdminOrder(admin, url.searchParams.get("id") ?? ""),
      );
    }

    if (request.method === "POST" && action === "orders.markPaid") {
      const payload = await readJson(request);
      const body =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? (payload as { orderId?: unknown; reference?: unknown })
          : {};
      const orderId =
        typeof body.orderId === "string" ? body.orderId.trim() : "";
      const reference =
        typeof body.reference === "string" && body.reference.trim()
          ? body.reference.trim().slice(0, 120)
          : null;

      if (!orderId) {
        throw new HttpError(400, "orderId is required");
      }

      return json(
        await markOrderPaidManually(admin, orderId, user, reference),
      );
    }

    if (request.method === "POST" && action === "orders.retryFulfillment") {
      const payload = await readJson(request);
      const orderId =
        payload &&
        typeof payload === "object" &&
        !Array.isArray(payload) &&
        typeof (payload as { orderId?: unknown }).orderId === "string"
          ? (payload as { orderId: string }).orderId
          : "";

      if (!orderId) {
        throw new HttpError(400, "orderId is required");
      }

      const result = await retrySupplierOrder(admin, orderId);
      waitUntil(triggerFulfillment(result.supplierOrderId));

      return json({ ok: true });
    }

    if (request.method === "GET" && action === "settings") {
      const key = new URL(request.url).searchParams.get("key");

      if (key) {
        const { data, error } = await admin
          .from("settings")
          .select("key,value,updated_at")
          .eq("key", key)
          .maybeSingle();

        if (error) {
          throw new HttpError(500, error.message);
        }

        return json({ setting: data });
      }

      const { data, error } = await admin
        .from("settings")
        .select("key,value,updated_at")
        .order("key");

      if (error) {
        throw new HttpError(500, error.message);
      }

      return json({ settings: data ?? [] });
    }

    if (request.method === "POST" && action === "setting") {
      let payload: SettingPayload;

      try {
        payload = (await request.json()) as SettingPayload;
      } catch {
        throw new HttpError(400, "Invalid JSON body");
      }

      if (
        typeof payload.key !== "string" ||
        !payload.key.trim() ||
        payload.value === undefined
      ) {
        throw new HttpError(400, "key and value are required");
      }

      const { data, error } = await admin
        .from("settings")
        .upsert(
          { key: payload.key.trim(), value: payload.value },
          { onConflict: "key" },
        )
        .select("key,value,updated_at")
        .single();

      if (error) {
        throw new HttpError(500, error.message);
      }

      return json({ setting: data });
    }

    throw new HttpError(404, "Unknown action");
  } catch (error) {
    return errorResponse(error);
  }
});
