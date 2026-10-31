import { z } from "npm:zod@4";

import { HttpError } from "../_shared/http.ts";
import { centsToAmount, toCents } from "../_shared/money.ts";
import { getPaymentProvider } from "../_shared/payments/index.ts";
import { requireSiteUrl } from "../_shared/site.ts";
import type { createAdminClient } from "../_shared/supabase.ts";
import { loadCart } from "./cart.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

const addressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).nullable().optional(),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(1).max(120),
  state: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(1).max(30),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
});

export const createOrderSchema = z.object({
  cartId: z.string().uuid(),
  email: z.string().trim().email().max(320),
  shipping: addressSchema,
  shippingRateName: z.string().trim().min(1).max(120),
  discountCode: z.string().trim().max(64).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

export const startPaymentSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().uuid(),
  cartId: z.string().uuid(),
});

export const previewOrderSchema = z.object({
  orderNumber: z.string().trim().min(1).max(64),
  token: z.string().uuid().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

type ShippingRateRow = {
  id: string;
  name: string;
  country_code: string;
  amount: unknown;
  free_over: unknown;
  min_days: number | null;
  max_days: number | null;
};

type DiscountCodeRow = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: unknown;
  min_subtotal: unknown;
  max_uses: number | null;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

export type CheckoutContext = {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  email: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  totalCents: number;
  shippingRateName: string;
  items: Array<{
    title: string;
    quantity: number;
    unitAmountCents: number;
  }>;
};

async function findShippingRate(
  admin: AdminClient,
  countryCode: string,
  name: string,
): Promise<ShippingRateRow> {
  const { data, error } = await admin
    .from("shipping_rates")
    .select("id,name,country_code,amount,free_over,min_days,max_days")
    .eq("is_active", true)
    .eq("name", name)
    .in("country_code", [countryCode, "*"]);

  if (error) {
    throw new HttpError(500, error.message);
  }

  const rates = (data ?? []) as ShippingRateRow[];
  const rate =
    rates.find((item) => item.country_code === countryCode) ??
    rates.find((item) => item.country_code === "*");

  if (!rate) {
    throw new HttpError(400, "The selected shipping rate is not available");
  }

  return rate;
}

async function findDiscountCode(
  admin: AdminClient,
  code: string,
  subtotalCents: number,
): Promise<DiscountCodeRow | null> {
  const { data, error } = await admin
    .from("discount_codes")
    .select(
      "id,code,type,value,min_subtotal,max_uses,used_count,starts_at,ends_at,is_active",
    )
    .eq("code", code.toUpperCase())
    .maybeSingle<DiscountCodeRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!data || !data.is_active) {
    throw new HttpError(400, "This discount code is not valid");
  }

  const now = Date.now();

  if (data.starts_at && new Date(data.starts_at).getTime() > now) {
    throw new HttpError(400, "This discount code is not active yet");
  }

  if (data.ends_at && new Date(data.ends_at).getTime() < now) {
    throw new HttpError(400, "This discount code has expired");
  }

  if (data.max_uses !== null && data.used_count >= data.max_uses) {
    throw new HttpError(400, "This discount code has reached its limit");
  }

  const minSubtotal = toCents(data.min_subtotal);

  if (minSubtotal !== null && subtotalCents < minSubtotal) {
    throw new HttpError(
      400,
      "Your subtotal is too low for this discount code",
    );
  }

  return data;
}

function discountCentsFor(
  discount: DiscountCodeRow | null,
  subtotalCents: number,
): number {
  if (!discount) {
    return 0;
  }

  const valueCents = toCents(discount.value) ?? 0;

  if (discount.type === "percent") {
    return Math.min(
      subtotalCents,
      Math.max(0, Math.round((subtotalCents * valueCents) / 10_000)),
    );
  }

  return Math.min(subtotalCents, Math.max(0, valueCents));
}

export async function createOrder(
  admin: AdminClient,
  input: CreateOrderInput,
  userId: string | null,
): Promise<CheckoutContext> {
  const cart = await loadCart(admin, input.cartId);

  if (!cart || cart.items.length === 0) {
    throw new HttpError(400, "Your cart is empty");
  }

  if (cart.hasUnavailableItems) {
    throw new HttpError(
      400,
      "Some items in your cart are unavailable. Remove them and try again.",
    );
  }

  const currency = cart.currency || "USD";
  const subtotalCents = cart.subtotalCents;
  const shippingRate = await findShippingRate(
    admin,
    input.shipping.countryCode,
    input.shippingRateName,
  );

  const freeOverCents = toCents(shippingRate.free_over);
  const shippingCents =
    freeOverCents !== null && subtotalCents >= freeOverCents
      ? 0
      : toCents(shippingRate.amount) ?? 0;

  const discountCode = input.discountCode
    ? await findDiscountCode(admin, input.discountCode, subtotalCents)
    : null;
  const discountCents = discountCentsFor(discountCode, subtotalCents);
  const totalCents = Math.max(
    0,
    subtotalCents + shippingCents - discountCents,
  );

  const variantIds = cart.items.map((item) => item.variantId);
  const { data: costRows, error: costError } = await admin
    .from("supplier_variants")
    .select("variant_id,cost_price")
    .eq("supplier", "cj")
    .in("variant_id", variantIds);

  if (costError) {
    throw new HttpError(500, costError.message);
  }

  const costByVariant = new Map<string, number>();

  for (const row of costRows ?? []) {
    costByVariant.set(row.variant_id, toCents(row.cost_price) ?? 0);
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      email: input.email,
      status: "pending_payment",
      payment_status: "pending",
      fulfillment_status: "unfulfilled",
      currency,
      subtotal: centsToAmount(subtotalCents),
      shipping_total: centsToAmount(shippingCents),
      discount_total: centsToAmount(discountCents),
      tax_total: 0,
      total: centsToAmount(totalCents),
      discount_code_id: discountCode?.id ?? null,
      shipping_rate_name: shippingRate.name,
      ship_name: input.shipping.name,
      ship_phone: input.shipping.phone ?? null,
      ship_line1: input.shipping.line1,
      ship_line2: input.shipping.line2 ?? null,
      ship_city: input.shipping.city,
      ship_state: input.shipping.state ?? null,
      ship_postal_code: input.shipping.postalCode,
      ship_country_code: input.shipping.countryCode,
      customer_note: input.note ?? null,
    })
    .select(
      "id,order_number,access_token,email,currency,subtotal,shipping_total,discount_total,total",
    )
    .single<{
      id: string;
      order_number: string;
      access_token: string;
      email: string;
      currency: string;
      subtotal: unknown;
      shipping_total: unknown;
      discount_total: unknown;
      total: unknown;
    }>();

  if (orderError || !order) {
    throw new HttpError(500, orderError?.message ?? "Could not create order");
  }

  try {
    const itemRows = cart.items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      variant_id: item.variantId,
      title: item.productTitle,
      variant_title: item.variantTitle,
      sku: item.sku,
      image_url: item.imageUrl,
      unit_price: centsToAmount(item.unitPriceCents),
      quantity: item.quantity,
    }));

    const { data: insertedItems, error: itemError } = await admin
      .from("order_items")
      .insert(itemRows)
      .select("id,variant_id,unit_price,quantity");

    if (itemError || !insertedItems) {
      throw new HttpError(500, itemError?.message ?? "Could not save order items");
    }

    const costRowsToInsert = insertedItems.map((item) => ({
      order_item_id: item.id,
      unit_cost: centsToAmount(costByVariant.get(item.variant_id) ?? 0),
      currency,
    }));

    const { error: itemCostError } = await admin
      .from("order_item_costs")
      .insert(costRowsToInsert);

    if (itemCostError) {
      throw new HttpError(500, itemCostError.message);
    }

    const totalQuantity = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const lowMarginItems: Array<Record<string, unknown>> = [];

    for (const item of cart.items) {
      const unitCostCents = costByVariant.get(item.variantId) ?? 0;
      const allocatedShippingCents =
        totalQuantity > 0
          ? Math.round((shippingCents * item.quantity) / totalQuantity)
          : 0;

      if (unitCostCents + allocatedShippingCents >= item.unitPriceCents) {
        lowMarginItems.push({
          variantId: item.variantId,
          title: item.productTitle,
          variantTitle: item.variantTitle,
          unitPriceCents: item.unitPriceCents,
          unitCostCents,
          allocatedShippingCents,
        });
      }
    }

    if (lowMarginItems.length > 0) {
      const { error: eventError } = await admin.from("order_events").insert({
        order_id: order.id,
        type: "margin_guard",
        message: "Low margin detected at checkout — review pricing",
        is_public: false,
        data: { items: lowMarginItems },
      });

      if (eventError) {
        throw new HttpError(500, eventError.message);
      }
    }

    const { error: createdEventError } = await admin
      .from("order_events")
      .insert({
        order_id: order.id,
        type: "order_created",
        message: "Order placed",
        is_public: true,
      });

    if (createdEventError) {
      throw new HttpError(500, createdEventError.message);
    }
  } catch (error) {
    await admin.from("orders").delete().eq("id", order.id);
    throw error;
  }

  return {
    orderId: order.id,
    orderNumber: order.order_number,
    accessToken: order.access_token,
    email: order.email,
    currency: order.currency,
    subtotalCents,
    shippingCents,
    discountCents,
    totalCents,
    shippingRateName: shippingRate.name,
    items: cart.items.map((item) => ({
      title:
        item.variantTitle && item.variantTitle !== "Default"
          ? `${item.productTitle} — ${item.variantTitle}`
          : item.productTitle,
      quantity: item.quantity,
      unitAmountCents: item.unitPriceCents,
    })),
  };
}

export type StartPaymentResult = {
  provider: string;
  checkoutId: string;
  redirectUrl: string;
  orderNumber: string;
};

type StartPaymentOrderRow = {
  id: string;
  order_number: string;
  access_token: string;
  email: string;
  currency: string;
  status: string;
  payment_status: string;
  shipping_total: unknown;
  total: unknown;
};

type StartPaymentItemRow = {
  title: string;
  variant_title: string | null;
  quantity: number;
  unit_price: unknown;
};

/**
 * Starts the payment provider from inside the edge function so
 * PAYMENT_PROVIDER, PAYMENT_WEBHOOK_SECRET, and any provider API key stay in
 * Supabase function secrets instead of the Next.js environment.
 */
export async function startPayment(
  admin: AdminClient,
  input: z.infer<typeof startPaymentSchema>,
): Promise<StartPaymentResult> {
  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id,order_number,access_token,email,currency,status,payment_status,shipping_total,total",
    )
    .eq("id", input.orderId)
    .maybeSingle<StartPaymentOrderRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!order || order.access_token !== input.accessToken) {
    throw new HttpError(404, "Order not found");
  }

  if (order.status !== "pending_payment" || order.payment_status === "paid") {
    throw new HttpError(409, "Order is not awaiting payment");
  }

  const { data: itemRows, error: itemError } = await admin
    .from("order_items")
    .select("title,variant_title,quantity,unit_price")
    .eq("order_id", order.id)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new HttpError(500, itemError.message);
  }

  const items = ((itemRows ?? []) as StartPaymentItemRow[]).map((item) => ({
    title:
      item.variant_title && item.variant_title !== "Default"
        ? `${item.title} — ${item.variant_title}`
        : item.title,
    quantity: item.quantity,
    unitAmountCents: toCents(item.unit_price) ?? 0,
  }));

  let started: {
    provider: string;
    checkoutId: string;
    redirectUrl: string;
  };

  try {
    const baseUrl = requireSiteUrl();
    const successUrl = `${baseUrl}/checkout/success?order=${encodeURIComponent(
      order.order_number,
    )}&token=${encodeURIComponent(order.access_token)}`;
    const cancelUrl = `${baseUrl}/cart`;
    const provider = getPaymentProvider();
    const checkout = await provider.createCheckout({
      orderId: order.id,
      orderNumber: order.order_number,
      email: order.email,
      currency: order.currency,
      amountCents: toCents(order.total) ?? 0,
      items,
      shippingCents: toCents(order.shipping_total) ?? 0,
      successUrl,
      cancelUrl,
    });

    started = {
      provider: provider.name,
      checkoutId: checkout.checkoutId,
      redirectUrl: checkout.redirectUrl,
    };
  } catch (error) {
    console.error("Payment checkout creation failed:", error);

    // Do not leave an orphan pending_payment order when the provider cannot
    // start a checkout.
    await admin.from("orders").delete().eq("id", order.id);

    throw new HttpError(
      502,
      "Could not start the payment. Please try again.",
    );
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({
      payment_provider: started.provider,
      provider_checkout_id: started.checkoutId,
    })
    .eq("id", order.id);

  if (updateError) {
    throw new HttpError(500, updateError.message);
  }

  const { error: cartError } = await admin
    .from("cart_items")
    .delete()
    .eq("cart_id", input.cartId);

  if (cartError) {
    throw new HttpError(500, cartError.message);
  }

  return {
    provider: started.provider,
    checkoutId: started.checkoutId,
    redirectUrl: started.redirectUrl,
    orderNumber: order.order_number,
  };
}

export type OrderPreview = {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  email: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  shippingRateName: string | null;
  createdAt: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postalCode: string;
    countryCode: string;
  };
  items: Array<{
    title: string;
    variantTitle: string | null;
    sku: string | null;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }>;
  shipments: Array<{
    carrier: string | null;
    trackingNumber: string;
    trackingUrl: string | null;
    status: string;
  }>;
  events: Array<{
    type: string;
    message: string | null;
    createdAt: string;
  }>;
};

export async function previewOrder(
  admin: AdminClient,
  input: z.infer<typeof previewOrderSchema>,
  userId: string | null,
): Promise<OrderPreview> {
  let query = admin
    .from("orders")
    .select(
      "id,order_number,access_token,status,payment_status,fulfillment_status,email,currency,subtotal,shipping_total,discount_total,tax_total,total,shipping_rate_name,ship_name,ship_line1,ship_line2,ship_city,ship_state,ship_postal_code,ship_country_code,created_at",
    )
    .eq("order_number", input.orderNumber);

  if (input.token) {
    query = query.eq("access_token", input.token);
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else {
    throw new HttpError(404, "Order not found");
  }

  const { data: order, error } = await query.maybeSingle();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!order) {
    throw new HttpError(404, "Order not found");
  }

  const [itemResult, shipmentResult, eventResult] = await Promise.all([
    admin
      .from("order_items")
      .select("title,variant_title,sku,image_url,unit_price,quantity,line_total")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    admin
      .from("shipments")
      .select("carrier,tracking_number,tracking_url,status")
      .eq("order_id", order.id),
    admin
      .from("order_events")
      .select("type,message,created_at")
      .eq("order_id", order.id)
      .eq("is_public", true)
      .order("created_at", { ascending: true }),
  ]);

  if (itemResult.error || shipmentResult.error || eventResult.error) {
    throw new HttpError(
      500,
      itemResult.error?.message ??
        shipmentResult.error?.message ??
        eventResult.error?.message ??
        "Could not load order",
    );
  }

  return {
    orderNumber: order.order_number,
    status: order.status,
    paymentStatus: order.payment_status,
    fulfillmentStatus: order.fulfillment_status,
    email: order.email,
    currency: order.currency,
    subtotalCents: toCents(order.subtotal) ?? 0,
    shippingCents: toCents(order.shipping_total) ?? 0,
    discountCents: toCents(order.discount_total) ?? 0,
    taxCents: toCents(order.tax_total) ?? 0,
    totalCents: toCents(order.total) ?? 0,
    shippingRateName: order.shipping_rate_name,
    createdAt: order.created_at,
    shippingAddress: {
      name: order.ship_name,
      line1: order.ship_line1,
      line2: order.ship_line2,
      city: order.ship_city,
      state: order.ship_state,
      postalCode: order.ship_postal_code,
      countryCode: order.ship_country_code,
    },
    items: (itemResult.data ?? []).map((item) => ({
      title: item.title,
      variantTitle: item.variant_title,
      sku: item.sku,
      imageUrl: item.image_url,
      unitPriceCents: toCents(item.unit_price) ?? 0,
      quantity: item.quantity,
      lineTotalCents: toCents(item.line_total) ?? 0,
    })),
    shipments: (shipmentResult.data ?? []).map((shipment) => ({
      carrier: shipment.carrier,
      trackingNumber: shipment.tracking_number,
      trackingUrl: shipment.tracking_url,
      status: shipment.status,
    })),
    events: (eventResult.data ?? []).map((event) => ({
      type: event.type,
      message: event.message,
      createdAt: event.created_at,
    })),
  };
}
