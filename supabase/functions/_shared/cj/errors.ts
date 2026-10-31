export class CjError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CjConfigError extends CjError {}

export class CjTokenStoreError extends CjError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class CjNetworkError extends CjError {
  readonly retryable: boolean;

  constructor(message: string, retryable = true, options?: { cause?: unknown }) {
    super(message);
    this.retryable = retryable;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export class CjHttpError extends CjError {
  readonly status: number;
  readonly retryable: boolean;
  readonly retryAfterMs: number;

  constructor(status: number, retryAfterMs = 0, options?: { cause?: unknown }) {
    super(`CJ request failed with HTTP ${status}`);
    this.status = status;
    this.retryable = status === 429 || status >= 500;
    this.retryAfterMs = retryAfterMs;
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

const RETRYABLE_CODES = new Set([1600000, 1600200, 1600301]);

export class CjApiError extends CjError {
  readonly code: number;
  readonly requestId: string | null;
  readonly retryable: boolean;
  readonly retryAfterMs: number;

  constructor(input: {
    code: number;
    message: string;
    requestId?: string | null;
    retryAfterMs?: number;
  }) {
    super(input.message);
    this.code = input.code;
    this.requestId = input.requestId ?? null;
    this.retryable = RETRYABLE_CODES.has(input.code);
    this.retryAfterMs = input.retryAfterMs ?? 0;
  }
}

export class CjValidationError extends CjError {
  readonly requestId: string | null;

  constructor(message: string, requestId?: string | null) {
    super(message);
    this.requestId = requestId ?? null;
  }
}

export function isRetryableCjError(error: unknown): boolean {
  if (error instanceof CjNetworkError) {
    return error.retryable;
  }

  if (error instanceof CjHttpError) {
    return error.retryable;
  }

  if (error instanceof CjApiError) {
    return error.retryable;
  }

  return false;
}

export function retryAfterMs(error: unknown): number {
  if (error instanceof CjHttpError || error instanceof CjApiError) {
    return error.retryAfterMs;
  }

  return 0;
}
