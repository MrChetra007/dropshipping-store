import { HttpError } from "../http.ts";
import { mockPaymentProvider } from "./mock.ts";
import type { PaymentProvider } from "./types.ts";

export function getPaymentProvider(): PaymentProvider {
  const provider = (Deno.env.get("PAYMENT_PROVIDER") ?? "mock")
    .trim()
    .toLowerCase();

  switch (provider) {
    case "mock":
      return mockPaymentProvider;
    default:
      throw new HttpError(
        500,
        `Unsupported payment provider "${provider}". Set PAYMENT_PROVIDER=mock until a provider is chosen.`,
      );
  }
}
