import type { ZodType } from "npm:zod@4";

import {
  CjApiError,
  CjConfigError,
  CjHttpError,
  CjNetworkError,
  CjValidationError,
  isRetryableCjError,
  retryAfterMs,
} from "./errors.ts";
import type { CjTokenStore } from "./token-store.ts";
import {
  CJ_BASE_URL,
  cjEnvelopeSchema,
  cjTokenDataSchema,
  type CjEnvelope,
  type CjTokenData,
} from "./types.ts";

const ACCESS_TOKEN_REFRESH_MARGIN_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MIN_LIFETIME_MS = 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const MIN_REQUEST_INTERVAL_MS = 1_000;

export type CjQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number>;

export type CjRequestOptions<T> = {
  method?: "GET" | "POST";
  query?: Record<string, CjQueryValue>;
  body?: unknown;
  schema: ZodType<T>;
  requiresAuth?: boolean;
  retryNetwork?: boolean;
  /** Some CJ endpoints return `data: null` on success (payBalance). */
  allowEmptyData?: boolean;
};

export type CjClientOptions = {
  apiKey: string;
  tokenStore: CjTokenStore;
  baseUrl?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  minRequestIntervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headers: Headers, now: number): number {
  const value = headers.get("Retry-After");

  if (!value) {
    return 0;
  }

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const date = Date.parse(value);

  return Number.isNaN(date) ? 0 : Math.max(0, date - now);
}

function apiErrorFromEnvelope(
  envelope: CjEnvelope,
  headers: Headers,
  now: number,
): CjApiError {
  return new CjApiError({
    code: envelope.code,
    message: envelope.message ?? "CJ request failed",
    requestId: envelope.requestId,
    retryAfterMs: parseRetryAfter(headers, now),
  });
}

export class CjClient {
  private readonly apiKey: string;
  private readonly tokenStore: CjTokenStore;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly minRequestIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  private tokenPromise: Promise<string> | null = null;
  private rateGate: Promise<void> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: CjClientOptions) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new CjConfigError("CJ_API_KEY is empty");
    }

    const baseUrl = (options.baseUrl ?? CJ_BASE_URL).replace(/\/+$/, "");

    try {
      new URL(baseUrl);
    } catch {
      throw new CjConfigError("CJ base URL is invalid");
    }

    this.apiKey = apiKey;
    this.tokenStore = options.tokenStore;
    this.baseUrl = baseUrl;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.minRequestIntervalMs = Math.max(
      0,
      options.minRequestIntervalMs ?? MIN_REQUEST_INTERVAL_MS,
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
  }

  async getAccessToken(options: { force?: boolean } = {}): Promise<string> {
    if (this.tokenPromise) {
      return this.tokenPromise;
    }

    this.tokenPromise = this.resolveAccessToken(options.force ?? false).finally(
      () => {
        this.tokenPromise = null;
      },
    );

    return this.tokenPromise;
  }

  /**
   * CJ signs webhooks with the account openId. Older token rows may not have it
   * stored yet, so force one refresh/auth to capture it.
   */
  async getOpenId(): Promise<string> {
    await this.getAccessToken();

    let tokens = await this.tokenStore.get();

    if (!tokens?.openId) {
      await this.getAccessToken({ force: true });
      tokens = await this.tokenStore.get();
    }

    if (!tokens?.openId) {
      throw new CjValidationError("CJ did not return an openId");
    }

    return tokens.openId;
  }

  async request<T>(
    path: string,
    options: CjRequestOptions<T>,
  ): Promise<T> {
    const maxAttempts = options.retryNetwork === false ? 1 : this.maxAttempts;
    let attempt = 0;
    let authRetried = false;

    while (true) {
      attempt += 1;

      try {
        const token =
          options.requiresAuth === false
            ? null
            : await this.getAccessToken();

        return await this.execute(path, options, token);
      } catch (error) {
        if (
          !authRetried &&
          error instanceof CjApiError &&
          (error.code === 1600001 || error.code === 1600002)
        ) {
          authRetried = true;
          await this.getAccessToken({ force: true });
          continue;
        }

        if (attempt >= maxAttempts || !isRetryableCjError(error)) {
          throw error;
        }

        await sleep(this.retryDelay(error, attempt));
      }
    }
  }

  private async resolveAccessToken(force: boolean): Promise<string> {
    const now = this.now();
    const tokens = await this.tokenStore.get();

    if (
      !force &&
      tokens?.accessToken &&
      tokens.accessExpiresAt.getTime() - now >
        ACCESS_TOKEN_REFRESH_MARGIN_MS
    ) {
      return tokens.accessToken;
    }

    if (
      tokens?.refreshToken &&
      tokens.refreshExpiresAt.getTime() - now >
        REFRESH_TOKEN_MIN_LIFETIME_MS
    ) {
      try {
        return await this.refreshAccessToken(tokens.refreshToken);
      } catch (error) {
        if (!(error instanceof CjApiError) || error.code !== 1600003) {
          throw error;
        }
      }
    }

    return this.authenticate();
  }

  private async authenticate(): Promise<string> {
    const data = await this.execute<CjTokenData>(
      "/authentication/getAccessToken",
      {
        method: "POST",
        body: { apiKey: this.apiKey },
        schema: cjTokenDataSchema,
        requiresAuth: false,
        retryNetwork: false,
      },
      null,
    );

    return this.saveTokenData(data);
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const data = await this.execute<CjTokenData>(
      "/authentication/refreshAccessToken",
      {
        method: "POST",
        body: { refreshToken },
        schema: cjTokenDataSchema,
        requiresAuth: false,
        retryNetwork: false,
      },
      null,
    );

    return this.saveTokenData(data);
  }

  private async saveTokenData(data: CjTokenData): Promise<string> {
    const accessExpiresAt = new Date(data.accessTokenExpiryDate);
    const refreshExpiresAt = new Date(data.refreshTokenExpiryDate);

    if (
      Number.isNaN(accessExpiresAt.getTime()) ||
      Number.isNaN(refreshExpiresAt.getTime())
    ) {
      throw new CjValidationError("CJ returned an invalid token expiry date");
    }

    await this.tokenStore.save({
      openId: data.openId === null || data.openId === undefined
        ? null
        : String(data.openId),
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      accessExpiresAt,
      refreshExpiresAt,
    });

    return data.accessToken;
  }

  private async execute<T>(
    path: string,
    options: CjRequestOptions<T>,
    token: string | null,
  ): Promise<T> {
    await this.waitForRateLimit();

    const url = this.buildUrl(path, options.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (token) {
      headers["CJ-Access-Token"] = token;
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method:
          options.method ?? (options.body === undefined ? "GET" : "POST"),
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new CjNetworkError("Could not reach CJ", true, { cause: error });
    }

    let text: string;

    try {
      text = await response.text();
    } catch (error) {
      throw new CjNetworkError("Could not read the CJ response", true, {
        cause: error,
      });
    }

    let payload: unknown;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      if (!response.ok) {
        throw new CjHttpError(
          response.status,
          parseRetryAfter(response.headers, this.now()),
        );
      }

      throw new CjValidationError(`CJ returned non-JSON for ${path}`);
    }

    const envelopeResult = cjEnvelopeSchema.safeParse(payload);

    if (!envelopeResult.success) {
      if (!response.ok) {
        throw new CjHttpError(
          response.status,
          parseRetryAfter(response.headers, this.now()),
        );
      }

      throw new CjValidationError(`CJ returned an invalid envelope for ${path}`);
    }

    const envelope = envelopeResult.data;

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        throw new CjHttpError(
          response.status,
          parseRetryAfter(response.headers, this.now()),
        );
      }

      if (envelope.code === 200) {
        throw new CjHttpError(
          response.status,
          parseRetryAfter(response.headers, this.now()),
        );
      }

      throw apiErrorFromEnvelope(envelope, response.headers, this.now());
    }

    if (envelope.code !== 200 || envelope.result === false) {
      throw apiErrorFromEnvelope(envelope, response.headers, this.now());
    }

    if (envelope.data === null || envelope.data === undefined) {
      if (!options.allowEmptyData) {
        throw new CjValidationError(
          `CJ returned no data for ${path}`,
          envelope.requestId,
        );
      }
    }

    const dataResult = options.schema.safeParse(envelope.data);

    if (!dataResult.success) {
      const detail = dataResult.error.issues
        .slice(0, 3)
        .map((issue) => `${issue.path.join(".") || "data"}: ${issue.message}`)
        .join("; ");

      throw new CjValidationError(
        `Unexpected CJ response for ${path}: ${detail}`,
        envelope.requestId,
      );
    }

    return dataResult.data;
  }

  private buildUrl(
    path: string,
    query?: Record<string, CjQueryValue>,
  ): string {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(key, String(item));
        }
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return url.toString();
  }

  private async waitForRateLimit(): Promise<void> {
    const previousGate = this.rateGate;
    let release: () => void = () => {};

    this.rateGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousGate;

    const wait = this.minRequestIntervalMs - (this.now() - this.lastRequestAt);

    if (wait > 0) {
      await sleep(wait);
    }

    this.lastRequestAt = this.now();
    release();
  }

  private retryDelay(error: unknown, attempt: number): number {
    const exponential = Math.min(500 * 2 ** (attempt - 1), 8_000);
    const jitter = Math.floor(Math.random() * 250);

    return Math.max(retryAfterMs(error), exponential + jitter);
  }
}
