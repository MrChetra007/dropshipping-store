import { z } from "npm:zod@4";

import { HttpError } from "../http.ts";
import type { PaymentProvider, VerifiedPaymentEvent } from "./types.ts";

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
  const secret = Deno.env.get("PAYMENT_WEBHOOK_SECRET");

  if (!secret) {
    throw new HttpError(500, "Webhook verification is not configured");
  }

  return secret;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(received: string, expected: string): boolean {
  if (received.length !== expected.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < received.length; index += 1) {
    difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return difference === 0;
}

export async function signMockWebhook(rawBody: string): Promise<string> {
  return hmacHex(requireWebhookSecret(), rawBody);
}

function toVerifiedEvent(event: MockEvent): VerifiedPaymentEvent {
  if (event.type === "payment.paid") {
    if (
      !event.paymentId ||
      event.amountCents === undefined ||
      !event.currency
    ) {
      throw new HttpError(400, "Paid events require paymentId, amountCents and currency");
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
      throw new HttpError(400, "Refunded events require paymentId and amountCents");
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

  async verifyWebhook(
    rawBody: string,
    headers: Headers,
  ): Promise<VerifiedPaymentEvent> {
    const received = headers.get("x-mock-signature")?.trim() ?? "";

    if (!received) {
      throw new HttpError(401, "Missing webhook signature");
    }

    const expected = await signMockWebhook(rawBody);

    if (!timingSafeEqual(received.toLowerCase(), expected)) {
      throw new HttpError(401, "Invalid webhook signature");
    }

    let payload: unknown;

    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "Invalid webhook payload");
    }

    const parsed = mockEventSchema.safeParse(payload);

    if (!parsed.success) {
      throw new HttpError(400, "Invalid webhook payload");
    }

    return toVerifiedEvent(parsed.data);
  },
};
