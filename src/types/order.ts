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
