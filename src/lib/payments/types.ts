export type CreateCheckoutInput = {
  orderId: string;
  orderNumber: string;
  email: string;
  currency: string;
  amountCents: number;
  items: { title: string; quantity: number; unitAmountCents: number }[];
  shippingCents: number;
  successUrl: string;
  cancelUrl: string;
};

export type CreateCheckoutResult = { checkoutId: string; redirectUrl: string };

export type VerifiedPaymentEvent =
  | {
      kind: "paid";
      eventId: string;
      orderId: string;
      paymentId: string;
      amountCents: number;
      currency: string;
      raw: unknown;
    }
  | { kind: "failed"; eventId: string; orderId: string; raw: unknown }
  | {
      kind: "refunded";
      eventId: string;
      orderId: string;
      paymentId: string;
      amountCents: number;
      raw: unknown;
    }
  | { kind: "ignored"; eventId: string; raw: unknown };

export interface PaymentProvider {
  name: string;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedPaymentEvent>;
}
