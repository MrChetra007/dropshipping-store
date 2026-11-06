import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

import { CjTokenStoreError } from "./errors.ts";
import type { CjTokenStore, CjTokens } from "./token-store.ts";

type TokenRow = {
  open_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  access_expires_at: string | null;
  refresh_expires_at: string | null;
};

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new CjTokenStoreError("Stored CJ token expiry date is invalid");
  }

  return date;
}

export class SupabaseCjTokenStore implements CjTokenStore {
  constructor(
    private readonly admin: SupabaseClient,
    private readonly supplier = "cj",
  ) {}

  async get(): Promise<CjTokens | null> {
    const { data, error } = await this.admin
      .from("supplier_tokens")
      .select(
        "open_id,access_token,refresh_token,access_expires_at,refresh_expires_at",
      )
      .eq("supplier", this.supplier)
      .maybeSingle<TokenRow>();

    if (error) {
      throw new CjTokenStoreError("Could not read CJ tokens", {
        cause: error,
      });
    }

    if (
      !data?.access_token ||
      !data.refresh_token ||
      !data.access_expires_at ||
      !data.refresh_expires_at
    ) {
      return null;
    }

    return {
      openId: data.open_id,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessExpiresAt: parseDate(data.access_expires_at),
      refreshExpiresAt: parseDate(data.refresh_expires_at),
    };
  }

  async save(tokens: CjTokens): Promise<void> {
    const { error } = await this.admin.from("supplier_tokens").upsert(
      {
        supplier: this.supplier,
        open_id: tokens.openId,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        access_expires_at: tokens.accessExpiresAt.toISOString(),
        refresh_expires_at: tokens.refreshExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "supplier" },
    );

    if (error) {
      throw new CjTokenStoreError("Could not save CJ tokens", {
        cause: error,
      });
    }
  }
}
