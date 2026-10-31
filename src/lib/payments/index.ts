import "server-only";

import { env } from "@/lib/env";
import { mockPaymentProvider } from "./providers/mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  const provider = env.PAYMENT_PROVIDER.trim().toLowerCase();

  switch (provider) {
    case "mock":
      return mockPaymentProvider;
    default:
      throw new Error(
        `Unsupported payment provider "${env.PAYMENT_PROVIDER}". Set PAYMENT_PROVIDER=mock until a provider is chosen.`,
      );
  }
}
