import { callEdgeFunction } from "@/lib/functions";
import { getCartId, clearStoredCartId } from "@/features/cart/cart-api";
import type { CheckoutContext, StartPaymentResult } from "@/types/order";

export type CheckoutAddress = {
  name: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
};

export type StartCheckoutInput = {
  email: string;
  shipping: CheckoutAddress;
  shippingRateName: string;
  discountCode?: string | null;
  note?: string | null;
};

export type StartCheckoutResult = {
  redirectUrl: string;
  orderNumber: string;
};

export async function startCheckout(
  input: StartCheckoutInput,
): Promise<StartCheckoutResult> {
  const cartId = getCartId();

  if (!cartId) {
    throw new Error("Your cart is empty. Add an item before checking out.");
  }

  const context = await callEdgeFunction<CheckoutContext>("store-api", {
    method: "POST",
    query: { action: "checkout.create" },
    body: {
      ...input,
      cartId,
    },
  });

  const payment = await callEdgeFunction<StartPaymentResult>("store-api", {
    method: "POST",
    query: { action: "checkout.startPayment" },
    body: {
      orderId: context.orderId,
      accessToken: context.accessToken,
      cartId,
    },
  });

  clearStoredCartId();

  return {
    redirectUrl: payment.redirectUrl,
    orderNumber: payment.orderNumber,
  };
}
