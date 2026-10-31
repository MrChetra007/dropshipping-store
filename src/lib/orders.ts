import "server-only";

import { callEdgeFunction, EdgeFunctionError } from "@/lib/supabase/functions";
import type { OrderPreview } from "@/types/order";

export async function getOrderPreview(
  orderNumber: string,
  token?: string,
): Promise<OrderPreview | null> {
  try {
    const data = await callEdgeFunction<{ order: OrderPreview }>("store-api", {
      query: { action: "order.preview", orderNumber, token },
    });

    return data.order;
  } catch (error) {
    if (error instanceof EdgeFunctionError && error.status === 404) {
      return null;
    }

    throw error;
  }
}
