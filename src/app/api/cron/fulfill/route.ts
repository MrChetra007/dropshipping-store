import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron";
import { env } from "@/lib/env";
import {
  callEdgeFunction,
  EdgeFunctionError,
} from "@/lib/supabase/functions";

type FulfillResult = {
  claimed: number;
  submitted: number;
  retried: number;
  failed: number;
  skipped: number;
  results: Array<Record<string, unknown>>;
};

export async function GET(request: Request) {
  const secret = env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!isCronAuthorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await callEdgeFunction<FulfillResult>("fulfill-order", {
      method: "POST",
      body: {},
      accessToken: secret,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EdgeFunctionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Fulfillment cron error:", error);
    return NextResponse.json(
      { error: "Could not run the fulfillment worker" },
      { status: 500 },
    );
  }
}
