import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { CART_COOKIE, cartCookieOptions, isCartId } from "@/lib/cart";
import { callEdgeFunction, EdgeFunctionError } from "@/lib/supabase/functions";
import type { Cart } from "@/types/cart";

const cartActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99).default(1),
  }),
  z.object({
    action: z.literal("update"),
    variantId: z.string().uuid(),
    quantity: z.number().int().min(0).max(99),
  }),
  z.object({
    action: z.literal("remove"),
    variantId: z.string().uuid(),
  }),
]);

type CartResponse = { cartId: string; cart: Cart };

function errorResponse(error: unknown): NextResponse {
  if (error instanceof EdgeFunctionError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  console.error("Cart API error:", error);
  return NextResponse.json({ error: "Could not update cart" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const cartId = request.cookies.get(CART_COOKIE)?.value;

  if (!isCartId(cartId)) {
    return NextResponse.json({ cart: null });
  }

  try {
    const data = await callEdgeFunction<{ cart: Cart | null }>("store-api", {
      query: { action: "cart.get", cartId },
    });

    return NextResponse.json({ cart: data.cart });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = cartActionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid cart request" },
      { status: 400 },
    );
  }

  const { action, ...payload } = parsed.data;
  const cartId = request.cookies.get(CART_COOKIE)?.value;
  const validCartId = isCartId(cartId) ? cartId : null;

  if (action !== "add" && !validCartId) {
    return NextResponse.json(
      { error: "Your cart has expired. Add an item to start a new cart." },
      { status: 400 },
    );
  }

  try {
    const data = await callEdgeFunction<CartResponse>("store-api", {
      method: "POST",
      query: { action: `cart.${action}` },
      body: { ...payload, cartId: validCartId },
    });

    const response = NextResponse.json({
      cart: data.cart,
      cartId: data.cartId,
    });

    if (data.cartId && data.cartId !== validCartId) {
      response.cookies.set(CART_COOKIE, data.cartId, cartCookieOptions());
    }

    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
