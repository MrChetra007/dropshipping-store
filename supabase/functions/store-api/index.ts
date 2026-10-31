import { z } from "npm:zod@4";

import { hasUserSubject } from "../_shared/auth.ts";
import { handleOptions, HttpError, json, errorResponse } from "../_shared/http.ts";
import { createAdminClient } from "../_shared/supabase.ts";
import {
  addToCart,
  loadCart,
  removeCartItem,
  updateCartItem,
} from "./cart.ts";
import {
  createOrder,
  createOrderSchema,
  previewOrder,
  previewOrderSchema,
  startPayment,
  startPaymentSchema,
} from "./checkout.ts";
import {
  mockPaySchema,
  processPaymentWebhook,
  simulateMockPayment,
} from "./payment-webhook.ts";

const cartIdSchema = z.string().uuid();

const addToCartSchema = z.object({
  cartId: z.string().uuid().nullable().optional(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

const updateCartSchema = z.object({
  cartId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.number().int().min(0).max(99),
});

const removeCartSchema = z.object({
  cartId: z.string().uuid(),
  variantId: z.string().uuid(),
});

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? "Invalid request",
    );
  }

  return result.data;
}

async function getUserId(
  request: Request,
  admin: ReturnType<typeof createAdminClient>,
): Promise<string | null> {
  const authorization = request.headers.get("Authorization");

  if (!authorization || !hasUserSubject(authorization)) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);

  if (error) {
    return null;
  }

  return data.user?.id ?? null;
}

Deno.serve(async (request) => {
  const optionsResponse = handleOptions(request);

  if (optionsResponse) {
    return optionsResponse;
  }

  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const admin = createAdminClient();

    if (request.method === "POST" && action === "payment.webhook") {
      const rawBody = await request.text();
      return json(
        await processPaymentWebhook(admin, rawBody, request.headers),
      );
    }

    const userId = await getUserId(request, admin);

    if (request.method === "GET" && action === "cart.get") {
      const cartId = url.searchParams.get("cartId");

      if (!cartId || !cartIdSchema.safeParse(cartId).success) {
        return json({ cart: null });
      }

      return json({ cart: await loadCart(admin, cartId) });
    }

    if (request.method === "POST" && action === "cart.add") {
      const input = parse(addToCartSchema, await readJson(request));
      return json(
        await addToCart(
          admin,
          input.cartId ?? null,
          userId,
          input.variantId,
          input.quantity,
        ),
      );
    }

    if (request.method === "POST" && action === "cart.update") {
      const input = parse(updateCartSchema, await readJson(request));
      return json(
        await updateCartItem(
          admin,
          input.cartId,
          userId,
          input.variantId,
          input.quantity,
        ),
      );
    }

    if (request.method === "POST" && action === "cart.remove") {
      const input = parse(removeCartSchema, await readJson(request));
      return json(
        await removeCartItem(
          admin,
          input.cartId,
          userId,
          input.variantId,
        ),
      );
    }

    if (request.method === "POST" && action === "checkout.create") {
      const input = parse(createOrderSchema, await readJson(request));
      return json(await createOrder(admin, input, userId));
    }

    if (request.method === "POST" && action === "checkout.startPayment") {
      const input = parse(startPaymentSchema, await readJson(request));
      return json(await startPayment(admin, input));
    }

    if (request.method === "POST" && action === "payment.mockPay") {
      const input = parse(mockPaySchema, await readJson(request));
      return json(await simulateMockPayment(admin, input));
    }

    if (request.method === "GET" && action === "order.preview") {
      const input = parse(previewOrderSchema, {
        orderNumber: url.searchParams.get("orderNumber"),
        token: url.searchParams.get("token") ?? undefined,
      });

      return json({ order: await previewOrder(admin, input, userId) });
    }

    throw new HttpError(404, "Unknown action");
  } catch (error) {
    return errorResponse(error);
  }
});
