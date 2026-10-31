import { NextResponse } from "next/server";

import {
  callEdgeFunction,
  EdgeFunctionError,
} from "@/lib/supabase/functions";

type TrackingResult = {
  checked: number;
  updated: number;
  emailed: number;
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
    const result = await callEdgeFunction<TrackingResult>("tracking-sync", {
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

    console.error("Tracking cron error:", error);
    return NextResponse.json(
      { error: "Could not run the tracking worker" },
      { status: 500 },
    );
  }
}
