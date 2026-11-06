import { z } from "npm:zod@4";

import type { CjClient } from "./client.ts";

const callbackSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith("https://"), "Must be an HTTPS URL");

const topicSchema = z
  .object({
    type: z.enum(["ENABLE", "CANCEL"]),
    callbackUrls: z.array(callbackSchema).min(1).max(1),
  })
  .strict();

const webhookSetInputSchema = z
  .object({
    callbackUrl: callbackSchema,
  })
  .strict();

export type CjWebhookSetInput = z.input<typeof webhookSetInputSchema>;

/**
 * Register the CJ order/logistics webhooks. CJ requires the product, stock,
 * order and logistics topics to be present in the same request.
 */
export async function setWebhook(
  client: CjClient,
  input: CjWebhookSetInput,
): Promise<boolean> {
  const { callbackUrl } = webhookSetInputSchema.parse(input);
  const topic = topicSchema.parse({
    type: "ENABLE",
    callbackUrls: [callbackUrl],
  });

  return client.request("/webhook/set", {
    method: "POST",
    body: {
      product: topic,
      stock: topic,
      order: topic,
      logistics: topic,
    },
    schema: z.boolean(),
  });
}
