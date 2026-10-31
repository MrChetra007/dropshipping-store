import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { env } from "@/lib/env";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  VerifiedPaymentEvent,
} from "../types";

const mockEventSchema = z.object({
  eventId: z.string().min(1).max(200),
  type: z.enum(["payment.paid", "payment.failed", "payment.refunded"]),
  orderId: z.string().uuid(),
  paymentId: z.string().min(1).max(200).optional(),
  amountCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

type MockEvent = z.infer<typeof mockEventSchema>;

function requireWebhookSecret(): string {
  const secret = env.PAYMENT_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("PAYMENT_WEBHOOK_SECRET is not set");
  }

  return secret;
}

function signaturesMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function signMockWebhook(rawBody: string): string {
  return createHmac("sha256", requireWebhookSecret())
    .update(rawBody)
    .digest("hex");
}

function toVerifiedEvent(event: MockEvent): VerifiedPaymentEvent {
  if (event.type === "payment.paid") {
    if (
      !event.paymentId ||
      event.amountCents === undefined ||
      !event.currency
    ) {
      throw new Error("Paid events require paymentId, amountCents and currency");
    }

    return {
      kind: "paid",
      eventId: event.eventId,
      orderId: event.orderId,
      paymentId: event.paymentId,
      amountCents: event.amountCents,
      currency: event.currency.toUpperCase(),
      raw: event,
    };
  }

  if (event.type === "payment.refunded") {
    if (!event.paymentId || event.amountCents === undefined) {
      throw new Error("Refunded events require paymentId and amountCents");
    }

    return {
      kind: "refunded",
      eventId: event.eventId,
      orderId: event.orderId,
      paymentId: event.paymentId,
      amountCents: event.amountCents,
      raw: event,
    };
  }

  return {
    kind: "failed",
    eventId: event.eventId,
    orderId: event.orderId,
    raw: event,
  };
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const redirectUrl = new URL(input.successUrl);
    redirectUrl.pathname = "/checkout/mock";
    redirectUrl.searchParams.set("order", input.orderNumber);
    redirectUrl.searchParams.set("orderId", input.orderId);

    return {
      checkoutId: `mock_${input.orderId}`,
      redirectUrl: redirectUrl.toString(),
    };
  },

  async verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<VerifiedPaymentEvent> {
    const received = headers.get("x-mock-signature")?.trim() ?? "";

    if (!received) {
      throw new Error("Missing webhook signature");
    }

    const expected = signMockWebhook(rawBody);

    if (!signaturesMatch(received, expected)) {
      throw new Error("Invalid webhook signature");
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid webhook payload");
    }

    const parsed = mockEventSchema.safeParse(payload);

    if (!parsed.success) {
      throw new Error("Invalid webhook payload");
    }

    return toVerifiedEvent(parsed.data);
  },
};
