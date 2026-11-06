import { z } from "npm:zod@4";

import { createCjClient } from "../cj/factory.ts";
import {
  createOrder,
  getBalance,
  getOrder,
  payBalance,
  payBalanceV2,
} from "../cj/orders.ts";
import {
  CjApiError,
  CjConfigError,
  CjHttpError,
  CjNetworkError,
  CjValidationError,
} from "../cj/errors.ts";
import type { CjCreateOrderInput } from "../cj/orders.ts";
import type { CjBalance, CjOrder } from "../cj/types.ts";
import { centsToAmount, toCents } from "../money.ts";
import type { createAdminClient } from "../supabase.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type SupplierOrderRow = {
  id: string;
  order_id: string;
  status: string;
  supplier_order_id: string | null;
  request: unknown;
  response: unknown;
  attempts: number;
};

export type FulfillmentOutcome =
  | { status: "submitted"; supplierOrderId: string }
  | { status: "retry"; error: string; nextAttemptAt: string }
  | { status: "failed"; error: string }
  | { status: "skipped"; reason: string };

type FulfillmentSettings = {
  autoPlaceOrders: boolean;
  defaultShippingMethod: string;
  maxAttempts: number;
  fromCountryCode: string;
  sandbox: boolean;
};

const fulfillmentSettingsSchema = z
  .object({
    auto_place_orders: z.boolean().default(true),
    default_shipping_method: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .default("CJPacket Ordinary"),
    max_attempts: z.number().int().min(1).max(20).default(5),
    from_country_code: z
      .string()
      .trim()
      .length(2)
      .transform((value) => value.toUpperCase())
      .default("CN"),
    sandbox: z.boolean().default(false),
  })
  .transform((value): FulfillmentSettings => ({
    autoPlaceOrders: value.auto_place_orders,
    defaultShippingMethod: value.default_shipping_method,
    maxAttempts: value.max_attempts,
    fromCountryCode: value.from_country_code,
    sandbox: value.sandbox,
  }));

const DEFAULT_SETTINGS: FulfillmentSettings = fulfillmentSettingsSchema.parse(
  {},
);

const BASE_RETRY_MS = 5 * 60 * 1000;
const MAX_RETRY_MS = 6 * 60 * 60 * 1000;

type OrderRow = {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_status: string;
  fulfillment_status: string;
  currency: string;
  ship_name: string;
  ship_phone: string | null;
  ship_line1: string;
  ship_line2: string | null;
  ship_city: string;
  ship_state: string | null;
  ship_postal_code: string;
  ship_country_code: string;
  customer_note: string | null;
};

type OrderItemRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  title: string;
  variant_title: string | null;
  sku: string | null;
  image_url: string | null;
  quantity: number;
};

type SupplierVariantRow = {
  variant_id: string;
  supplier_variant_id: string;
  supplier_sku: string | null;
};

type Failure = {
  code: string;
  message: string;
  permanent: boolean;
};

class FulfillmentError extends Error {
  readonly code: string;
  readonly permanent: boolean;

  constructor(message: string, code: string, permanent: boolean) {
    super(message);
    this.name = "FulfillmentError";
    this.code = code;
    this.permanent = permanent;
  }
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(countryCode: string): string {
  try {
    return regionNames.of(countryCode.toUpperCase()) ?? countryCode;
  } catch {
    return countryCode;
  }
}

function retryDelayMs(attempts: number): number {
  return Math.min(BASE_RETRY_MS * 2 ** Math.max(0, attempts - 1), MAX_RETRY_MS);
}

async function loadSettings(admin: AdminClient): Promise<FulfillmentSettings> {
  const { data, error } = await admin
    .from("settings")
    .select("value")
    .eq("key", "fulfillment.cj")
    .maybeSingle<{ value: unknown }>();

  if (error) {
    throw new Error(`Could not load fulfillment settings: ${error.message}`);
  }

  const parsed = fulfillmentSettingsSchema.safeParse(data?.value ?? {});

  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

async function loadOrder(
  admin: AdminClient,
  orderId: string,
): Promise<OrderRow | null> {
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,order_number,email,status,payment_status,fulfillment_status,currency,ship_name,ship_phone,ship_line1,ship_line2,ship_city,ship_state,ship_postal_code,ship_country_code,customer_note",
    )
    .eq("id", orderId)
    .maybeSingle<OrderRow>();

  if (error) {
    throw new Error(`Could not load order: ${error.message}`);
  }

  return data ?? null;
}

async function loadItems(
  admin: AdminClient,
  orderId: string,
): Promise<OrderItemRow[]> {
  const { data, error } = await admin
    .from("order_items")
    .select(
      "id,product_id,variant_id,title,variant_title,sku,image_url,quantity",
    )
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Could not load order items: ${error.message}`);
  }

  return (data ?? []) as OrderItemRow[];
}

async function loadSupplierVariants(
  admin: AdminClient,
  variantIds: string[],
): Promise<Map<string, SupplierVariantRow>> {
  if (variantIds.length === 0) {
    return new Map();
  }

  const { data, error } = await admin
    .from("supplier_variants")
    .select("variant_id,supplier_variant_id,supplier_sku")
    .eq("supplier", "cj")
    .in("variant_id", variantIds);

  if (error) {
    throw new Error(`Could not load supplier variants: ${error.message}`);
  }

  const rows = (data ?? []) as SupplierVariantRow[];

  return new Map(rows.map((row) => [row.variant_id, row]));
}

function truncate(value: string | null | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}

function buildCjPayload(
  order: OrderRow,
  items: OrderItemRow[],
  suppliers: Map<string, SupplierVariantRow>,
  settings: FulfillmentSettings,
): CjCreateOrderInput {
  const products = items.map((item) => {
    const supplier = item.variant_id ? suppliers.get(item.variant_id) : null;

    if (!supplier) {
      throw new FulfillmentError(
        `Variant ${item.variant_id ?? "(missing)"} is not mapped to a CJ variant`,
        "missing_supplier_variant",
        true,
      );
    }

    return {
      vid: supplier.supplier_variant_id,
      sku: supplier.supplier_sku ?? undefined,
      quantity: item.quantity,
      storeProductId: item.product_id ?? undefined,
      storeProductName: truncate(item.title, 200),
      storeProductImg: item.image_url?.slice(0, 500) ?? undefined,
      storeSku: item.sku?.slice(0, 60) ?? undefined,
      variantOptions: item.variant_title?.slice(0, 100) ?? undefined,
      storeLineItemId: item.id,
    };
  });

  const phone = (order.ship_phone ?? "").replace(/[^\d+]/g, "").slice(0, 20);

  return {
    orderNumber: order.order_number.slice(0, 50),
    shippingZip: order.ship_postal_code.slice(0, 20),
    shippingCountryCode: order.ship_country_code.toUpperCase(),
    shippingCountry: countryName(order.ship_country_code).slice(0, 50),
    shippingProvince: truncate(
      order.ship_state?.trim() || order.ship_city,
      50,
    ),
    shippingCity: truncate(order.ship_city, 50),
    shippingPhone: phone || undefined,
    shippingCustomerName: truncate(order.ship_name, 50),
    shippingAddress: truncate(order.ship_line1, 500),
    shippingAddress2: truncate(order.ship_line2, 500) || undefined,
    email: order.email.length <= 50 ? order.email : undefined,
    remark: truncate(order.customer_note, 500) || undefined,
    logisticName: settings.defaultShippingMethod,
    fromCountryCode: settings.fromCountryCode,
    payType: 3,
    isSandbox: settings.sandbox ? 1 : 0,
    products,
  };
}

function toFailure(error: unknown): Failure {
  if (error instanceof FulfillmentError) {
    return {
      code: error.code,
      message: error.message,
      permanent: error.permanent,
    };
  }

  if (error instanceof CjApiError) {
    if (error.code === 1604000 || error.code === 1604001) {
      return {
        code: "cj_insufficient_balance",
        message:
          error.code === 1604000
            ? "CJ account balance is insufficient. Top up the CJ account, then retry this order."
            : "CJ balance payment is temporarily restricted. Check the CJ account, then retry this order.",
        permanent: true,
      };
    }

    return {
      code: `cj_${error.code}`,
      message: error.message,
      permanent: !error.retryable,
    };
  }

  if (error instanceof CjConfigError) {
    return { code: "cj_config", message: error.message, permanent: true };
  }

  if (error instanceof CjHttpError) {
    return {
      code: `cj_http_${error.status}`,
      message: error.message,
      permanent: !error.retryable,
    };
  }

  if (error instanceof CjNetworkError) {
    return {
      code: "cj_network",
      message: error.message,
      permanent: !error.retryable,
    };
  }

  if (error instanceof CjValidationError) {
    return {
      code: "cj_validation",
      message: error.message,
      permanent: true,
    };
  }

  if (error instanceof Error) {
    return {
      code: "fulfillment_error",
      message: error.message,
      permanent: false,
    };
  }

  return {
    code: "unknown",
    message: "Unknown fulfillment error",
    permanent: false,
  };
}

function errorText(failure: Failure): string {
  return `${failure.code}: ${failure.message}`.slice(0, 2_000);
}

async function handleFailure(
  admin: AdminClient,
  row: SupplierOrderRow,
  error: unknown,
  settings: FulfillmentSettings,
): Promise<FulfillmentOutcome> {
  const failure = toFailure(error);
  const attempts = Math.max(1, row.attempts);
  const message = errorText(failure);

  if (!failure.permanent && attempts < settings.maxAttempts) {
    const nextAttemptAt = new Date(
      Date.now() + retryDelayMs(attempts),
    ).toISOString();
    const { error: updateError } = await admin
      .from("supplier_orders")
      .update({
        status: "queued",
        error: message,
        next_attempt_at: nextAttemptAt,
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(
        `Could not schedule the CJ retry: ${updateError.message}`,
      );
    }

    return { status: "retry", error: message, nextAttemptAt };
  }

  const { error: updateError } = await admin
    .from("supplier_orders")
    .update({
      status: "failed",
      error: message,
      next_attempt_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) {
    throw new Error(`Could not mark the CJ order failed: ${updateError.message}`);
  }

  const { error: orderError } = await admin
    .from("orders")
    .update({ fulfillment_status: "failed" })
    .eq("id", row.order_id);

  if (orderError) {
    console.error(
      `Could not mark order ${row.order_id} fulfillment failed: ${orderError.message}`,
    );
  }

  const balanceProblem = failure.code === "cj_insufficient_balance";

  const { error: eventError } = await admin.from("order_events").insert({
    order_id: row.order_id,
    type: balanceProblem ? "fulfillment_balance_error" : "fulfillment_failed",
    message: balanceProblem
      ? "CJ balance is insufficient — top up the CJ account, then retry the order"
      : "Could not send the order to CJ — retry from the admin order page",
    is_public: false,
    data: {
      code: failure.code,
      error: failure.message,
      attempts,
    },
  });

  if (eventError) {
    console.error(
      `Could not add the fulfillment failure event for order ${row.order_id}: ${eventError.message}`,
    );
  }

  return { status: "failed", error: message };
}

type CjOrderAmounts = {
  orderId?: string | null;
  orderNumber?: string | null;
  shipmentOrderId?: string | null;
  actualPayment?: unknown;
  orderAmount?: unknown;
  productAmount?: unknown;
  postageAmount?: unknown;
};

function positiveCents(value: unknown): number | null {
  const cents = toCents(value);

  return cents !== null && cents > 0 ? cents : null;
}

function orderCostCents(data: unknown): number | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const value = data as CjOrderAmounts;
  const cost =
    positiveCents(value.actualPayment) ??
    positiveCents(value.orderAmount) ??
    (positiveCents(value.productAmount) ?? 0) +
      (positiveCents(value.postageAmount) ?? 0);

  return cost > 0 ? cost : null;
}

function shipmentOrderIdFrom(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  return (data as CjOrderAmounts).shipmentOrderId?.trim() || null;
}

function isPaidCjStatus(
  status: string | null | undefined,
  paymentDate?: string | null,
): boolean {
  if (paymentDate?.trim()) {
    return true;
  }

  return ["PENDING", "PROCESSING", "UNSHIPPED", "SHIPPED", "DELIVERED"].includes(
    (status ?? "").trim().toUpperCase(),
  );
}

function isPaidCjOrder(order: CjOrder): boolean {
  return isPaidCjStatus(order.orderStatus, order.paymentDate);
}

function availableBalanceCents(balance: CjBalance): number | null {
  const amount = toCents(balance.amount);

  if (amount === null) {
    return null;
  }

  return amount - (toCents(balance.freezeAmount) ?? 0);
}

async function markCreated(
  admin: AdminClient,
  row: SupplierOrderRow,
  cjOrderId: string,
  payload: CjCreateOrderInput,
  response: unknown,
): Promise<void> {
  const { error } = await admin.rpc("mark_supplier_order_created", {
    p_supplier_order_id: row.id,
    p_cj_order_id: cjOrderId,
    p_request: payload,
    p_response: response,
  });

  if (error) {
    throw new Error(`Could not store the draft CJ order: ${error.message}`);
  }
}

async function markSubmitted(
  admin: AdminClient,
  row: SupplierOrderRow,
  order: OrderRow,
  payload: unknown,
  response: unknown,
  settings: FulfillmentSettings,
): Promise<FulfillmentOutcome> {
  const data = response as CjOrderAmounts;
  const supplierOrderId =
    data.orderId ?? data.orderNumber ?? order.order_number;
  const costCents =
    orderCostCents(response) ?? orderCostCents(row.response) ?? 0;

  const { error } = await admin.rpc("mark_supplier_order_submitted", {
    p_supplier_order_id: row.id,
    p_cj_order_id: supplierOrderId,
    p_shipping_method: settings.defaultShippingMethod,
    p_supplier_cost: centsToAmount(costCents),
    p_request: payload,
    p_response: response,
  });

  if (error) {
    throw new Error(`Could not store the CJ order: ${error.message}`);
  }

  return { status: "submitted", supplierOrderId };
}

/**
 * Submit one paid order to CJ. The caller must have claimed the row first
 * (`claim_supplier_orders` / `claim_supplier_order`), so `row.attempts` already
 * includes this attempt.
 */
export async function processSupplierOrder(
  admin: AdminClient,
  row: SupplierOrderRow,
): Promise<FulfillmentOutcome> {
  if (row.status !== "queued") {
    return { status: "skipped", reason: `status_${row.status}` };
  }

  let settings = DEFAULT_SETTINGS;

  try {
    settings = await loadSettings(admin);

    if (!settings.autoPlaceOrders) {
      throw new FulfillmentError(
        "Automatic CJ ordering is disabled (settings.fulfillment.cj.auto_place_orders = false)",
        "auto_place_disabled",
        true,
      );
    }

    const order = await loadOrder(admin, row.order_id);

    if (!order) {
      throw new FulfillmentError(
        `Order ${row.order_id} no longer exists`,
        "order_not_found",
        true,
      );
    }

    if (order.payment_status !== "paid") {
      throw new FulfillmentError(
        `Order ${order.order_number} is not paid`,
        "order_not_paid",
        true,
      );
    }

    if (order.status === "cancelled" || order.status === "refunded") {
      throw new FulfillmentError(
        `Order ${order.order_number} is ${order.status}`,
        "order_not_fulfillable",
        true,
      );
    }

    const items = await loadItems(admin, row.order_id);

    if (items.length === 0) {
      throw new FulfillmentError(
        `Order ${order.order_number} has no items`,
        "order_empty",
        true,
      );
    }

    const variantIds = items
      .map((item) => item.variant_id)
      .filter((value): value is string => Boolean(value));
    const suppliers = await loadSupplierVariants(admin, variantIds);
    const client = createCjClient();

    let payload: CjCreateOrderInput | null = null;
    let response: unknown = row.response;
    let cjOrderId = row.supplier_order_id?.trim() || null;
    let costCents = orderCostCents(response);
    let shipmentOrderId = shipmentOrderIdFrom(response);

    if (!cjOrderId) {
      // Create only (payType=3). Persist the CJ id before paying so a retry can
      // never create a second order for the same customer order.
      payload = buildCjPayload(order, items, suppliers, settings);
      const created = await createOrder(client, payload);
      cjOrderId =
        created.orderId?.trim() ||
        created.orderNumber?.trim() ||
        order.order_number;
      response = created;
      costCents = orderCostCents(created);
      shipmentOrderId = created.shipmentOrderId?.trim() || null;

      await markCreated(admin, row, cjOrderId, payload, created);

      if (isPaidCjStatus(created.orderStatus)) {
        return await markSubmitted(
          admin,
          row,
          order,
          payload,
          created,
          settings,
        );
      }
    } else {
      // The draft already exists. Re-read it so a previous attempt that paid
      // but crashed before the DB update is treated as paid, not paid twice.
      const current = await getOrder(client, { orderId: cjOrderId });
      response = current;
      costCents = orderCostCents(current) ?? costCents;
      shipmentOrderId = current.shipmentOrderId?.trim() || shipmentOrderId;

      if (current.orderStatus.trim().toUpperCase() === "CANCELLED") {
        throw new FulfillmentError(
          `CJ order ${cjOrderId} is cancelled`,
          "cj_order_cancelled",
          true,
        );
      }

      if (isPaidCjOrder(current)) {
        return await markSubmitted(
          admin,
          row,
          order,
          row.request,
          current,
          settings,
        );
      }
    }

    if (settings.sandbox) {
      // Sandbox orders may be auto-paid by createOrderV2 regardless of payType.
      const current = await getOrder(client, { orderId: cjOrderId });

      if (isPaidCjOrder(current)) {
        return await markSubmitted(
          admin,
          row,
          order,
          payload ?? row.request,
          current,
          settings,
        );
      }
    }

    if (!settings.sandbox && costCents !== null) {
      const balance = await getBalance(client);
      const available = availableBalanceCents(balance);

      if (available !== null && available < costCents) {
        throw new FulfillmentError(
          `CJ balance is insufficient: available ${centsToAmount(available).toFixed(2)} USD, needed ${centsToAmount(costCents).toFixed(2)} USD. Top up the CJ account, then retry this order.`,
          "cj_insufficient_balance",
          true,
        );
      }
    }

    try {
      if (shipmentOrderId) {
        await payBalanceV2(client, { shipmentOrderId });
      } else {
        await payBalance(client, { orderId: cjOrderId });
      }
    } catch (error) {
      // A retry (or sandbox auto-payment) may have paid the draft already.
      let current: CjOrder | null = null;

      try {
        current = await getOrder(client, { orderId: cjOrderId });
      } catch {
        current = null;
      }

      if (!current || !isPaidCjOrder(current)) {
        throw error;
      }

      response = current;
      costCents = orderCostCents(current) ?? costCents;
    }

    return await markSubmitted(
      admin,
      row,
      order,
      payload ?? row.request,
      response,
      settings,
    );
  } catch (error) {
    return handleFailure(admin, row, error, settings);
  }
}
