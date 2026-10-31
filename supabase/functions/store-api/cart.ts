import { HttpError } from "../_shared/http.ts";
import type { createAdminClient } from "../_shared/supabase.ts";
import { toCents } from "../_shared/money.ts";

type AdminClient = ReturnType<typeof createAdminClient>;

export type CartItemDto = {
  id: string;
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  imageUrl: string | null;
  unitPriceCents: number;
  currency: string;
  quantity: number;
  lineTotalCents: number;
  stock: number | null;
  isActive: boolean;
};

export type CartDto = {
  id: string;
  currency: string;
  items: CartItemDto[];
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
};

type CartRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  currency: string;
  expires_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  title: string;
  sku: string;
  price: unknown;
  currency: string;
  stock: number | null;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export async function loadCart(
  admin: AdminClient,
  cartId: string,
): Promise<CartDto | null> {
  const { data: cart, error } = await admin
    .from("carts")
    .select("id,user_id,email,currency,expires_at")
    .eq("id", cartId)
    .maybeSingle<CartRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!cart || isExpired(cart.expires_at)) {
    return null;
  }

  const { data: itemRows, error: itemError } = await admin
    .from("cart_items")
    .select("id,variant_id,quantity,created_at")
    .eq("cart_id", cart.id)
    .order("created_at", { ascending: true });

  if (itemError) {
    throw new HttpError(500, itemError.message);
  }

  if (!itemRows || itemRows.length === 0) {
    return {
      id: cart.id,
      currency: cart.currency,
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      hasUnavailableItems: false,
    };
  }

  const variantIds = itemRows.map((item) => item.variant_id);
  const { data: variants, error: variantError } = await admin
    .from("product_variants")
    .select("id,product_id,title,sku,price,currency,stock,is_active")
    .in("id", variantIds);

  if (variantError) {
    throw new HttpError(500, variantError.message);
  }

  const variantRows = (variants ?? []) as VariantRow[];
  const variantById = new Map(variantRows.map((variant) => [variant.id, variant]));
  const productIds = [
    ...new Set(variantRows.map((variant) => variant.product_id)),
  ];

  let productRows: ProductRow[] = [];
  let imageRows: Array<{
    product_id: string;
    variant_id: string | null;
    url: string;
    sort_order: number;
  }> = [];

  if (productIds.length > 0) {
    const [productResult, imageResult] = await Promise.all([
      admin
        .from("products")
        .select("id,slug,title,status")
        .in("id", productIds),
      admin
        .from("product_images")
        .select("product_id,variant_id,url,sort_order")
        .in("product_id", productIds)
        .order("sort_order", { ascending: true }),
    ]);

    if (productResult.error) {
      throw new HttpError(500, productResult.error.message);
    }

    if (imageResult.error) {
      throw new HttpError(500, imageResult.error.message);
    }

    productRows = (productResult.data ?? []) as ProductRow[];
    imageRows = imageResult.data ?? [];
  }

  const productById = new Map(productRows.map((product) => [product.id, product]));
  const variantImage = new Map<string, string>();
  const productImage = new Map<string, string>();

  for (const image of imageRows) {
    if (image.variant_id && !variantImage.has(image.variant_id)) {
      variantImage.set(image.variant_id, image.url);
    }

    if (!productImage.has(image.product_id)) {
      productImage.set(image.product_id, image.url);
    }
  }

  const items: CartItemDto[] = [];

  for (const item of itemRows) {
    const variant = variantById.get(item.variant_id);

    if (!variant) {
      continue;
    }

    const product = productById.get(variant.product_id);
    const unitPriceCents = toCents(variant.price) ?? 0;
    const inStock = variant.stock === null || variant.stock > 0;
    const isActive = Boolean(
      product && product.status === "active" && variant.is_active && inStock,
    );

    items.push({
      id: item.id,
      variantId: variant.id,
      productId: variant.product_id,
      productSlug: product?.slug ?? "",
      productTitle: product?.title ?? variant.title,
      variantTitle: variant.title,
      sku: variant.sku,
      imageUrl:
        variantImage.get(variant.id) ??
        productImage.get(variant.product_id) ??
        null,
      unitPriceCents,
      currency: variant.currency || cart.currency,
      quantity: item.quantity,
      lineTotalCents: unitPriceCents * item.quantity,
      stock: variant.stock,
      isActive,
    });
  }

  return {
    id: cart.id,
    currency: items[0]?.currency ?? cart.currency,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
    hasUnavailableItems: items.some((item) => !item.isActive),
  };
}

async function createCart(
  admin: AdminClient,
  userId: string | null,
  email: string | null,
): Promise<CartRow> {
  const { data, error } = await admin
    .from("carts")
    .insert({ user_id: userId, email })
    .select("id,user_id,email,currency,expires_at")
    .single<CartRow>();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Could not create cart");
  }

  return data;
}

export async function ensureCart(
  admin: AdminClient,
  cartId: string | null,
  userId: string | null,
): Promise<CartRow> {
  if (cartId) {
    const { data, error } = await admin
      .from("carts")
      .select("id,user_id,email,currency,expires_at")
      .eq("id", cartId)
      .maybeSingle<CartRow>();

    if (error) {
      throw new HttpError(500, error.message);
    }

    if (data && !isExpired(data.expires_at)) {
      if (userId && !data.user_id) {
        await admin.from("carts").update({ user_id: userId }).eq("id", data.id);
        data.user_id = userId;
      }

      return data;
    }
  }

  return createCart(admin, userId, null);
}

async function getPurchasableVariant(
  admin: AdminClient,
  variantId: string,
): Promise<{ variant: VariantRow; product: ProductRow }> {
  const { data: variant, error } = await admin
    .from("product_variants")
    .select("id,product_id,title,sku,price,currency,stock,is_active")
    .eq("id", variantId)
    .maybeSingle<VariantRow>();

  if (error) {
    throw new HttpError(500, error.message);
  }

  if (!variant) {
    throw new HttpError(404, "Product variant not found");
  }

  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,slug,title,status")
    .eq("id", variant.product_id)
    .maybeSingle<ProductRow>();

  if (productError) {
    throw new HttpError(500, productError.message);
  }

  if (!product || product.status !== "active" || !variant.is_active) {
    throw new HttpError(400, "This product is not available");
  }

  if (variant.stock !== null && variant.stock <= 0) {
    throw new HttpError(400, "This product is out of stock");
  }

  return { variant, product };
}

function assertStock(variant: VariantRow, quantity: number): void {
  if (quantity > 99) {
    throw new HttpError(400, "Maximum quantity per item is 99");
  }

  if (variant.stock !== null && quantity > variant.stock) {
    throw new HttpError(
      400,
      variant.stock === 0
        ? "This product is out of stock"
        : `Only ${variant.stock} left in stock`,
    );
  }
}

export async function addToCart(
  admin: AdminClient,
  cartId: string | null,
  userId: string | null,
  variantId: string,
  quantity: number,
): Promise<{ cartId: string; cart: CartDto }> {
  const cart = await ensureCart(admin, cartId, userId);
  const { variant } = await getPurchasableVariant(admin, variantId);

  const { data: existing, error: existingError } = await admin
    .from("cart_items")
    .select("id,quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId)
    .maybeSingle<{ id: string; quantity: number }>();

  if (existingError) {
    throw new HttpError(500, existingError.message);
  }

  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  assertStock(variant, nextQuantity);

  if (existing) {
    const { error } = await admin
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", existing.id);

    if (error) {
      throw new HttpError(500, error.message);
    }
  } else {
    const { error } = await admin.from("cart_items").insert({
      cart_id: cart.id,
      variant_id: variantId,
      quantity,
    });

    if (error) {
      throw new HttpError(500, error.message);
    }
  }

  await admin
    .from("carts")
    .update({ expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() })
    .eq("id", cart.id);

  const updated = await loadCart(admin, cart.id);

  if (!updated) {
    throw new HttpError(500, "Could not load cart");
  }

  return { cartId: cart.id, cart: updated };
}

export async function updateCartItem(
  admin: AdminClient,
  cartId: string,
  userId: string | null,
  variantId: string,
  quantity: number,
): Promise<{ cartId: string; cart: CartDto }> {
  const cart = await ensureCart(admin, cartId, userId);

  const { data: existing, error: existingError } = await admin
    .from("cart_items")
    .select("id,quantity")
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId)
    .maybeSingle<{ id: string; quantity: number }>();

  if (existingError) {
    throw new HttpError(500, existingError.message);
  }

  if (!existing) {
    throw new HttpError(404, "This item is not in your cart");
  }

  if (quantity <= 0) {
    const { error } = await admin
      .from("cart_items")
      .delete()
      .eq("id", existing.id);

    if (error) {
      throw new HttpError(500, error.message);
    }
  } else {
    const { variant } = await getPurchasableVariant(admin, variantId);
    assertStock(variant, quantity);

    const { error } = await admin
      .from("cart_items")
      .update({ quantity })
      .eq("id", existing.id);

    if (error) {
      throw new HttpError(500, error.message);
    }
  }

  const updated = await loadCart(admin, cart.id);

  if (!updated) {
    throw new HttpError(500, "Could not load cart");
  }

  return { cartId: cart.id, cart: updated };
}

export async function removeCartItem(
  admin: AdminClient,
  cartId: string,
  userId: string | null,
  variantId: string,
): Promise<{ cartId: string; cart: CartDto }> {
  const cart = await ensureCart(admin, cartId, userId);

  const { error } = await admin
    .from("cart_items")
    .delete()
    .eq("cart_id", cart.id)
    .eq("variant_id", variantId);

  if (error) {
    throw new HttpError(500, error.message);
  }

  const updated = await loadCart(admin, cart.id);

  if (!updated) {
    throw new HttpError(500, "Could not load cart");
  }

  return { cartId: cart.id, cart: updated };
}
