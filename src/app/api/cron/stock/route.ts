import { NextResponse } from "next/server";

import {
  callEdgeFunction,
  EdgeFunctionError,
} from "@/lib/supabase/functions";

type StockResult = {
  checked: number;
  updated: number;
  disabled: number;
  enabled: number;
  flagged: number;
  repriced: number;
  failed: number;
  results: Array<Record<string, unknown>>;
};

/**
 * Forwards the caller's bearer token to the edge worker. The worker verifies
 * CRON_SECRET itself, so Next.js never reads or stores the secret.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callEdgeFunction<StockResult>("stock-sync", {
      method: "POST",
      body: {},
      authorization,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EdgeFunctionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Stock cron error:", error);
    return NextResponse.json(
      { error: "Could not run the stock sync worker" },
      { status: 500 },
    );
  }
}
