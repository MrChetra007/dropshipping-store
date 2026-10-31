import { NextResponse, type NextRequest } from "next/server";

import {
  callEdgeFunctionRaw,
  EdgeFunctionError,
} from "@/lib/supabase/functions";

/**
 * Headers a payment provider may use to sign the raw request body. Forward them
 * untouched so the edge function can verify the signature.
 */
const SIGNATURE_HEADERS = [
  "content-type",
  "x-mock-signature",
  "stripe-signature",
  "x-signature",
  "x-webhook-signature",
  "x-event-id",
];

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers: Record<string, string> = {};

  for (const name of SIGNATURE_HEADERS) {
    const value = request.headers.get(name);

    if (value) {
      headers[name] = value;
    }
  }

  try {
    const result = await callEdgeFunctionRaw<{
      status: string;
      error?: string;
    }>("store-api", {
      query: { action: "payment.webhook" },
      body: rawBody,
      headers,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EdgeFunctionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Payment webhook error:", error);
    return NextResponse.json(
      { error: "Could not process webhook" },
      { status: 500 },
    );
  }
}
