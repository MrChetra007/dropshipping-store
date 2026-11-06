import { HttpError } from "../http.ts";
import type {
  CreateCheckoutInput,
  CreateCheckoutResult,
  PaymentProvider,
  VerifiedPaymentEvent,
} from "./types.ts";

/**
 * Bank-transfer / manual payment.
 *
 * The customer is sent to an instructions page after checkout. Payment is
 * confirmed by an admin from the admin order page, which calls the
 * `mark_order_paid` RPC and then kicks the normal CJ fulfillment worker. There
 * is no provider callback, so this provider has no webhook.
 */
export const manualPaymentProvider: PaymentProvider = {
  name: "manual",

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const redirectUrl = new URL(input.successUrl);
    redirectUrl.pathname = "/checkout/manual";
    redirectUrl.searchParams.set("order", input.orderNumber);

    return {
      checkoutId: `manual_${input.orderId}`,
      redirectUrl: redirectUrl.toString(),
    };
  },

  async verifyWebhook(): Promise<VerifiedPaymentEvent> {
    throw new HttpError(
      404,
      "Manual payments are confirmed from the admin order page",
    );
  },
};
