import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { CART_COOKIE, isCartId } from "@/lib/cart";
import { getPaymentProvider } from "@/lib/payments";
import type { CreateCheckoutResult } from "@/lib/payments/types";
import { siteUrl } from "@/lib/site";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/supabase/functions";
import type { CheckoutContext } from "@/types/order";

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
    .regex(/^[A-Za-z]{2}$/, "Choose a valid country")
    .transform((value) => value.toUpperCase()),
});

const checkoutSchema = z.object({
  email: z.string().trim().email().max(320),
  shipping: addressSchema,
  shippingRateName: z.string().trim().min(1).max(120),
  discountCode: z.string().trim().max(64).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
});

function errorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof EdgeFunctionError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Checkout error:", error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function POST(request: NextRequest) {
  const cartId = request.cookies.get(CART_COOKIE)?.value;

  if (!isCartId(cartId)) {
    return NextResponse.json(
      { error: "Your cart is empty. Add an item before checking out." },
      { status: 400 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout details" },
      { status: 400 },
    );
  }

  let context: CheckoutContext;

  try {
    context = await callEdgeFunction<CheckoutContext>("store-api", {
      method: "POST",
      query: { action: "checkout.create" },
      body: { ...parsed.data, cartId },
    });
  } catch (error) {
    return errorResponse(error, "Could not create your order");
  }

  const provider = getPaymentProvider();
  const successUrl = `${siteUrl()}/checkout/success?order=${encodeURIComponent(
    context.orderNumber,
  )}&token=${encodeURIComponent(context.accessToken)}`;
  const cancelUrl = `${siteUrl()}/cart`;

  let checkout: CreateCheckoutResult;

  try {
    checkout = await provider.createCheckout({
      orderId: context.orderId,
      orderNumber: context.orderNumber,
      email: context.email,
      currency: context.currency,
      amountCents: context.totalCents,
      items: context.items,
      shippingCents: context.shippingCents,
      successUrl,
      cancelUrl,
    });
  } catch (error) {
    console.error("Payment checkout creation failed:", error);

    try {
      await callEdgeFunction("store-api", {
        method: "POST",
        query: { action: "checkout.abort" },
        body: {
          orderId: context.orderId,
          accessToken: context.accessToken,
        },
      });
    } catch (abortError) {
      console.error("Could not abort pending order:", abortError);
    }

    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 502 },
    );
  }

  try {
    await callEdgeFunction("store-api", {
      method: "POST",
      query: { action: "checkout.attachPayment" },
      body: {
        orderId: context.orderId,
        accessToken: context.accessToken,
        cartId,
        provider: provider.name,
        checkoutId: checkout.checkoutId,
      },
    });
  } catch (error) {
    console.error("Could not attach payment to order:", error);
    return NextResponse.json(
      { error: "Could not start the payment. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    redirectUrl: checkout.redirectUrl,
    orderNumber: context.orderNumber,
  });
}
