import { z } from "npm:zod@4";

export const CJ_BASE_URL =
  "https://developers.cjdropshipping.com/api2.0/v1";

const numericValue = z
  .union([z.string(), z.number()])
  .transform((value, context) => {
    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      context.addIssue({
        code: "custom",
        message: "Expected a numeric value",
      });
      return z.NEVER;
    }

    return parsed;
  });

const nullableNumeric = numericValue
  .nullish()
  .transform((value) => value ?? null);

const flexibleNumericValue = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : trimmed;
  });

const stringValue = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

const nullableString = stringValue
  .nullish()
  .transform((value) => value ?? null);

function stringArray() {
  return z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []);
}

function numericArray() {
  return z
    .array(numericValue)
    .nullish()
    .transform((value) => value ?? []);
}

export const cjEnvelopeSchema = z
  .object({
    code: z.number(),
    result: z.boolean().nullish(),
    message: z.string().nullish(),
    data: z.unknown().nullish(),
    requestId: z.string().nullish(),
    success: z.boolean().nullish(),
  })
  .passthrough();

export type CjEnvelope = z.infer<typeof cjEnvelopeSchema>;

export const cjTokenDataSchema = z
  .object({
    openId: z.union([z.string(), z.number()]).nullish(),
    accessToken: z.string().min(1),
    accessTokenExpiryDate: z.string().min(1),
    refreshToken: z.string().min(1),
    refreshTokenExpiryDate: z.string().min(1),
    createDate: z.string().nullish(),
  })
  .passthrough();

export type CjTokenData = z.infer<typeof cjTokenDataSchema>;

export const cjProductSummarySchema = z
  .object({
    id: z.string().min(1),
    nameEn: nullableString,
    sku: nullableString,
    spu: nullableString,
    bigImage: nullableString,
    sellPrice: flexibleNumericValue,
    nowPrice: flexibleNumericValue,
    discountPrice: flexibleNumericValue,
    discountPriceRate: flexibleNumericValue,
    listedNum: nullableNumeric,
    categoryId: nullableString,
    threeCategoryName: nullableString,
    twoCategoryId: nullableString,
    twoCategoryName: nullableString,
    oneCategoryId: nullableString,
    oneCategoryName: nullableString,
    warehouseInventoryNum: nullableNumeric,
    totalVerifiedInventory: nullableNumeric,
    totalUnVerifiedInventory: nullableNumeric,
    verifiedWarehouse: nullableNumeric,
    addMarkStatus: nullableNumeric,
    productType: nullableString,
    productKey: nullableString,
    productKeyEn: nullableString,
    description: nullableString,
    deliveryCycle: nullableString,
    saleStatus: nullableString,
    authorityStatus: nullableString,
    customization: nullableNumeric,
    isVideo: nullableNumeric,
    videoList: z
      .array(z.unknown())
      .nullish()
      .transform((value) => value ?? []),
    createAt: nullableNumeric,
  })
  .passthrough();

export type CjProductSummary = z.infer<typeof cjProductSummarySchema>;

export const cjProductListDataSchema = z
  .object({
    pageSize: nullableNumeric,
    pageNumber: nullableNumeric,
    totalRecords: nullableNumeric,
    totalPages: nullableNumeric,
    content: z
      .array(
        z
          .object({
            productList: z.array(cjProductSummarySchema).nullish(),
            relatedCategoryList: z
              .array(
                z
                  .object({
                    categoryId: nullableString,
                    categoryName: nullableString,
                  })
                  .passthrough(),
              )
              .nullish(),
            keyWord: nullableString,
            keyWordOld: nullableString,
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export const cjInventorySchema = z
  .object({
    countryCode: z.string().min(1),
    totalInventory: nullableNumeric,
    cjInventory: nullableNumeric,
    factoryInventory: nullableNumeric,
    verifiedWarehouse: nullableNumeric,
    stock: z
      .array(
        z
          .object({
            stockId: nullableString,
            inventory: nullableNumeric,
            factoryInventory: nullableNumeric,
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export const cjVariantSchema = z
  .object({
    vid: z.string().min(1),
    pid: nullableString,
    variantName: nullableString,
    variantNameEn: nullableString,
    variantSku: nullableString,
    variantImage: nullableString,
    barcode: nullableString,
    variantUnit: nullableString,
    variantKey: nullableString,
    variantLength: nullableNumeric,
    variantWidth: nullableNumeric,
    variantHeight: nullableNumeric,
    variantVolume: nullableNumeric,
    variantWeight: nullableNumeric,
    variantSellPrice: nullableNumeric,
    variantSugSellPrice: nullableNumeric,
    variantStandard: nullableString,
    createTime: nullableString,
    inventories: z.array(cjInventorySchema).nullish(),
  })
  .passthrough();

export type CjVariant = z.infer<typeof cjVariantSchema>;

export const cjProductSchema = z
  .object({
    pid: z.string().min(1),
    productName: nullableString,
    productNameEn: nullableString,
    productSku: nullableString,
    bigImage: nullableString,
    productImageSet: stringArray(),
    productWeight: flexibleNumericValue,
    productUnit: nullableString,
    productType: nullableString,
    categoryId: nullableString,
    categoryName: nullableString,
    entryCode: nullableString,
    entryNameEn: nullableString,
    materialKey: nullableString,
    materialNameEn: nullableString,
    packingWeight: flexibleNumericValue,
    productKey: nullableString,
    productKeyEn: nullableString,
    productProEn: nullableString,
    productProEnSet: stringArray(),
    sellPrice: flexibleNumericValue,
    suggestSellPrice: nullableString,
    description: nullableString,
    listedNum: nullableNumeric,
    status: nullableString,
    saleStatus: nullableString,
    supplierName: nullableString,
    supplierId: nullableString,
    customizationVersion: nullableNumeric,
    variants: z.array(cjVariantSchema).nullish(),
    createrTime: nullableString,
  })
  .passthrough();

export type CjProduct = z.infer<typeof cjProductSchema>;

export const cjOrderProductSchema = z
  .object({
    vid: nullableString,
    quantity: nullableNumeric,
    sellPrice: nullableNumeric,
    lineItemId: nullableString,
    storeLineItemId: nullableString,
    orderNumber: nullableString,
    productionOrderStatus: nullableNumeric,
    abnormalType: numericArray(),
  })
  .passthrough();

export const cjOrderSchema = z
  .object({
    orderId: z.string().min(1),
    orderNum: nullableString,
    platformOrderId: nullableString,
    cjOrderId: nullableString,
    cjOrderCode: nullableString,
    fromCountryCode: nullableString,
    shippingCountryCode: nullableString,
    shippingProvince: nullableString,
    shippingCity: nullableString,
    shippingAddress: nullableString,
    shippingCustomerName: nullableString,
    shippingPhone: nullableString,
    remark: nullableString,
    logisticName: nullableString,
    trackNumber: nullableString,
    trackingProvider: nullableString,
    trackingUrl: nullableString,
    disputeId: nullableString,
    disputeOpenedId: nullableString,
    orderWeight: nullableNumeric,
    orderAmount: nullableNumeric,
    productAmount: nullableNumeric,
    postageAmount: nullableNumeric,
    iossTaxes: nullableNumeric,
    iossTaxHandlingFee: nullableNumeric,
    tariff: nullableNumeric,
    logisticsClearanceOperationFee: nullableNumeric,
    currency: nullableString,
    orderStatus: z.string().min(1),
    subStatus: nullableString,
    createDate: nullableString,
    paymentDate: nullableString,
    outWarehouseTime: nullableString,
    storeCreateDate: nullableString,
    isComplete: nullableNumeric,
    isSandbox: nullableNumeric,
    storageId: nullableString,
    storageName: nullableString,
    shopId: nullableString,
    shopName: nullableString,
    productList: z.array(cjOrderProductSchema).nullish(),
  })
  .passthrough();

export type CjOrder = z.infer<typeof cjOrderSchema>;

export const cjCreateOrderDataSchema = z
  .object({
    orderNumber: nullableString,
    orderId: nullableString,
    shipmentOrderId: nullableString,
    iossAmount: nullableNumeric,
    iossTaxHandlingFee: nullableNumeric,
    postageAmount: nullableNumeric,
    productAmount: nullableNumeric,
    productOriginalAmount: nullableNumeric,
    productDiscountAmount: nullableNumeric,
    postageDiscountAmount: nullableNumeric,
    postageOriginalAmount: nullableNumeric,
    totalDiscountAmount: nullableNumeric,
    actualPayment: nullableNumeric,
    orderOriginalAmount: nullableNumeric,
    cjPayUrl: nullableString,
    orderAmount: nullableNumeric,
    logisticsMiss: nullableString,
    orderStatus: nullableString,
    interceptOrderReasons: z
      .array(
        z
          .object({
            code: nullableNumeric,
            message: nullableString,
          })
          .passthrough(),
      )
      .nullish(),
  })
  .passthrough();

export type CjCreateOrderData = z.infer<typeof cjCreateOrderDataSchema>;

export const cjTrackingSchema = z
  .object({
    trackingNumber: z.string().min(1),
    logisticName: nullableString,
    trackingFrom: nullableString,
    trackingTo: nullableString,
    deliveryDay: nullableString,
    deliveryTime: nullableString,
    trackingStatus: nullableString,
    lastMileCarrier: nullableString,
    lastTrackNumber: nullableString,
  })
  .passthrough();

export type CjTracking = z.infer<typeof cjTrackingSchema>;

export const cjBalanceSchema = z
  .object({
    amount: nullableNumeric,
    noWithdrawalAmount: nullableNumeric,
    freezeAmount: nullableNumeric,
  })
  .passthrough();

export type CjBalance = z.infer<typeof cjBalanceSchema>;
