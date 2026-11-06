import { callEdgeFunction } from "@/lib/functions";
import type { Cart } from "@/types/cart";

const CART_STORAGE_KEY = "cart_id";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCartId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function getCartId(): string | null {
  const value = window.localStorage.getItem(CART_STORAGE_KEY);

  return isCartId(value) ? value : null;
}

function setStoredCartId(cartId: string): void {
  if (isCartId(cartId)) {
    window.localStorage.setItem(CART_STORAGE_KEY, cartId);
  }
}

export function clearStoredCartId(): void {
  window.localStorage.removeItem(CART_STORAGE_KEY);
}

export async function getCart(): Promise<Cart | null> {
  const cartId = getCartId();

  if (!cartId) {
    return null;
  }

  const data = await callEdgeFunction<{ cart: Cart | null }>("store-api", {
    query: { action: "cart.get", cartId },
  });

  if (!data.cart) {
    clearStoredCartId();
    return null;
  }

  return data.cart;
}

type CartMutationResult = { cartId: string; cart: Cart };

export async function addToCart(
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const data = await callEdgeFunction<CartMutationResult>("store-api", {
    method: "POST",
    query: { action: "cart.add" },
    body: { cartId: getCartId(), variantId, quantity },
  });

  setStoredCartId(data.cartId);
  return data.cart;
}

function requireCartId(): string {
  const cartId = getCartId();

  if (!cartId) {
    throw new Error("Your cart is empty");
  }

  return cartId;
}

export async function updateCartItem(
  variantId: string,
  quantity: number,
): Promise<Cart> {
  const data = await callEdgeFunction<CartMutationResult>("store-api", {
    method: "POST",
    query: { action: "cart.update" },
    body: { cartId: requireCartId(), variantId, quantity },
  });

  setStoredCartId(data.cartId);
  return data.cart;
}

export async function removeCartItem(variantId: string): Promise<Cart> {
  const data = await callEdgeFunction<CartMutationResult>("store-api", {
    method: "POST",
    query: { action: "cart.remove" },
    body: { cartId: requireCartId(), variantId },
  });

  setStoredCartId(data.cartId);
  return data.cart;
}
