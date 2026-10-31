import "server-only";

import { cookies } from "next/headers";

import { callEdgeFunction } from "@/lib/supabase/functions";
import type { Cart } from "@/types/cart";

export const CART_COOKIE = "cart_id";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCartId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CART_COOKIE_MAX_AGE,
  };
}

export async function getCart(): Promise<Cart | null> {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE)?.value;

  if (!isCartId(cartId)) {
    return null;
  }

  const data = await callEdgeFunction<{ cart: Cart | null }>("store-api", {
    query: { action: "cart.get", cartId },
  });

  return data.cart;
}
