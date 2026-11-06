export type AdminSession = {
  user: {
    id: string;
    email: string | null;
    role: string;
  };
};

export type AdminProduct = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
  variantCount: number;
  activeVariantCount: number;
  minPrice: number | null;
  image: string | null;
  needsReviewCount: number;
};

export type AdminProductsResponse = {
  products: AdminProduct[];
};

export type AdminProductDetail = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    status: string;
    updatedAt: string;
  };
  supplierProductId: string | null;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    price: number;
    compareAtPrice: number | null;
    stock: number | null;
    weightG: number | null;
    isActive: boolean;
    autoDisabled: boolean;
    needsReview: boolean;
    reviewReason: string | null;
    sortOrder: number;
    costPrice: number | null;
  }>;
  images: Array<{
    id: string;
    url: string;
    alt: string | null;
    sortOrder: number;
    variantId: string | null;
  }>;
  categories: Array<{ id: string; name: string; slug: string }>;
};

export type AdminImportResult = {
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

export type CjSearchItem = {
  id: string;
  title: string;
  sku: string | null;
  image: string | null;
  price: number | null;
  category: string | null;
  inventory: number | null;
};

export type CjSearchResponse = {
  products: CjSearchItem[];
  page: number;
  totalPages: number;
  totalRecords: number;
};

export type CjVariant = {
  vid: string;
  title: string;
  sku: string | null;
  cost: number | null;
  stock: number | null;
  weightG: number | null;
  image: string | null;
  options: Record<string, string>;
  rawKey: string | null;
};

export type CjProductDetail = {
  pid: string;
  title: string;
  sku: string | null;
  description: string | null;
  category: string | null;
  images: string[];
  variants: CjVariant[];
};

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  totalCents: number;
  createdAt: string;
  supplierStatus: string | null;
  supplierError: string | null;
  supplierAttempts: number;
};

export type AdminOrdersResponse = {
  orders: AdminOrderSummary[];
};

export type AdminOrderItem = {
  id: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
  createdAt: string;
};

export type AdminOrderEvent = {
  id: number;
  type: string;
  message: string | null;
  isPublic: boolean;
  createdAt: string;
};

export type AdminSupplierOrder = {
  id: string;
  status: string;
  supplierOrderId: string | null;
  shippingMethod: string | null;
  supplierCostCents: number | null;
  attempts: number;
  nextAttemptAt: string;
  error: string | null;
  updatedAt: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  shipName: string;
  shipPhone: string | null;
  shipLine1: string;
  shipLine2: string | null;
  shipCity: string;
  shipState: string | null;
  shipPostalCode: string;
  shipCountryCode: string;
  customerNote: string | null;
  createdAt: string;
  paidAt: string | null;
  items: AdminOrderItem[];
  events: AdminOrderEvent[];
  supplierOrder: AdminSupplierOrder | null;
};

export type AdminOrderResponse = {
  order: AdminOrder;
};

export type MarkPaidStatus = "paid" | "duplicate" | "mismatch" | "ignored";

export const manualPaymentMessages: Record<string, string> = {
  paid: "Payment confirmed. The CJ order has been queued.",
  duplicate: "This order was already confirmed. No second payment was recorded.",
  mismatch:
    "The order total changed after the payment attempt. Review the order manually.",
  ignored: "The order is no longer awaiting payment. Review it manually.",
};
