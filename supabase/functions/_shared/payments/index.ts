import { HttpError } from "../http.ts";
import { manualPaymentProvider } from "./manual.ts";
import { mockPaymentProvider } from "./mock.ts";
import type { PaymentProvider } from "./types.ts";

export function getPaymentProvider(): PaymentProvider {
  const provider = (Deno.env.get("PAYMENT_PROVIDER") ?? "manual")
    .trim()
    .toLowerCase();

  switch (provider) {
    case "manual":
      return manualPaymentProvider;
    case "mock":
      return mockPaymentProvider;
    default:
      throw new HttpError(
        500,
        `Unsupported payment provider "${provider}". Set PAYMENT_PROVIDER to "manual" or "mock".`,
      );
  }
}
