import { z } from "npm:zod@4";

import type { CjClient } from "./client.ts";
import { CjApiError } from "./errors.ts";
import {
  cjBalanceSchema,
  cjCreateOrderDataSchema,
  cjOrderSchema,
  type CjBalance,
  type CjCreateOrderData,
  type CjOrder,
} from "./types.ts";

const orderProductSchema = z
  .object({
    vid: z.string().trim().min(1).max(50).optional(),
    sku: z.string().trim().min(1).max(50).optional(),
    storeProductId: z.string().max(64).optional(),
    storeProductImg: z.string().max(500).optional(),
    storeProductName: z.string().max(200).optional(),
    storeSku: z.string().max(60).optional(),
    variantOptions: z.string().max(100).optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative().optional(),
    storeLineItemId: z.string().max(125).optional(),
    podProperties: z.string().max(500).optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.vid || value.sku),
    "Each CJ order product needs a vid or sku",
  );

export const cjCreateOrderInputSchema = z
  .object({
    orderNumber: z.string().trim().min(1).max(50),
    shippingZip: z.string().max(20).optional(),
    shippingCountryCode: z.string().length(2),
    shippingCountry: z.string().trim().min(1).max(50),
    shippingProvince: z.string().trim().min(1).max(50),
    shippingCity: z.string().trim().min(1).max(50),
    shippingCounty: z.string().max(50).optional(),
    shippingPhone: z.string().max(20).optional(),
    shippingCustomerName: z.string().trim().min(1).max(50),
    shippingAddress: z.string().trim().min(1).max(500),
    shippingAddress2: z.string().max(500).optional(),
    houseNumber: z.string().max(20).optional(),
    email: z.string().email().max(50).optional(),
    taxId: z.string().max(20).optional(),
    remark: z.string().max(500).optional(),
    consigneeID: z.string().max(20).optional(),
    payType: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    isSandbox: z.union([z.literal(0), z.literal(1)]).optional(),
    shopAmount: z.number().nonnegative().optional(),
    logisticName: z.string().trim().min(1).max(50),
    fromCountryCode: z.string().length(2),
    platform: z.string().max(20).optional(),
    shopLogisticsType: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional(),
    storageId: z.string().max(40).optional(),
    iossType: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
    iossNumber: z.string().max(10).optional(),
    storeName: z.string().max(50).optional(),
    storeOrderTime: z.number().int().nonnegative().optional(),
    orderFlow: z.union([z.literal(1), z.literal(2)]).optional(),
    products: z.array(orderProductSchema).min(1),
  })
  .strict();

export type CjCreateOrderInput = z.input<typeof cjCreateOrderInputSchema>;

const getOrderInputSchema = z
  .object({
    orderId: z.string().trim().min(1).max(200),
    features: z.array(z.enum(["LOGISTICS_TIMELINESS"])).optional(),
  })
  .strict();

export type CjGetOrderInput = z.input<typeof getOrderInputSchema>;

const payBalanceInputSchema = z
  .object({
    orderId: z.string().trim().min(1).max(200),
  })
  .strict();

export type CjPayBalanceInput = z.input<typeof payBalanceInputSchema>;

const payBalanceV2InputSchema = z
  .object({
    shipmentOrderId: z.string().trim().min(1).max(200),
    payId: z.string().trim().min(1).max(200).optional(),
  })
  .strict();

export type CjPayBalanceV2Input = z.input<typeof payBalanceV2InputSchema>;

export async function createOrder(
  client: CjClient,
  input: CjCreateOrderInput,
): Promise<CjCreateOrderData> {
  const body = cjCreateOrderInputSchema.parse(input);

  try {
    return await client.request("/shopping/order/createOrderV2", {
      method: "POST",
      body,
      schema: cjCreateOrderDataSchema,
    });
  } catch (error) {
    if (!(error instanceof CjApiError) || error.code !== 1603003) {
      throw error;
    }

    const existing = await getOrder(client, { orderId: body.orderNumber });

    return {
      orderNumber: existing.orderNum ?? body.orderNumber,
      orderId: existing.orderId,
      shipmentOrderId: null,
      iossAmount: null,
      iossTaxHandlingFee: null,
      postageAmount: existing.postageAmount,
      productAmount: existing.productAmount,
      productOriginalAmount: null,
      productDiscountAmount: null,
      postageDiscountAmount: null,
      postageOriginalAmount: null,
      totalDiscountAmount: null,
      actualPayment: existing.orderAmount,
      orderOriginalAmount: existing.orderAmount,
      cjPayUrl: null,
      orderAmount: existing.orderAmount,
      logisticsMiss: null,
      orderStatus: existing.orderStatus,
      interceptOrderReasons: [],
    };
  }
}

export async function getOrder(
  client: CjClient,
  input: CjGetOrderInput,
): Promise<CjOrder> {
  const parameters = getOrderInputSchema.parse(input);

  return client.request("/shopping/order/getOrderDetail", {
    method: "GET",
    query: {
      orderId: parameters.orderId,
      features: parameters.features,
    },
    schema: cjOrderSchema,
  });
}

export async function getBalance(client: CjClient): Promise<CjBalance> {
  return client.request("/shopping/pay/getBalance", {
    method: "GET",
    schema: cjBalanceSchema,
  });
}

/**
 * Pay a single (non-parent) order from the CJ wallet.
 * `data` is null on success.
 */
export async function payBalance(
  client: CjClient,
  input: CjPayBalanceInput,
): Promise<void> {
  const body = payBalanceInputSchema.parse(input);

  await client.request("/shopping/pay/payBalance", {
    method: "POST",
    body,
    schema: z.unknown(),
    allowEmptyData: true,
  });
}

/**
 * Pay a parent/shipment order from the CJ wallet. Use this when createOrderV2
 * returned a shipmentOrderId. `data` is null on success.
 */
export async function payBalanceV2(
  client: CjClient,
  input: CjPayBalanceV2Input,
): Promise<void> {
  const body = payBalanceV2InputSchema.parse(input);

  await client.request("/shopping/pay/payBalanceV2", {
    method: "POST",
    body,
    schema: z.unknown(),
    allowEmptyData: true,
  });
}
