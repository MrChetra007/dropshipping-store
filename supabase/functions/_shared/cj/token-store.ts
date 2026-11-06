export type CjTokens = {
  openId: string | null;
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
};

export interface CjTokenStore {
  get(): Promise<CjTokens | null>;
  save(tokens: CjTokens): Promise<void>;
}

export class MemoryCjTokenStore implements CjTokenStore {
  private tokens: CjTokens | null = null;

  get(): Promise<CjTokens | null> {
    return Promise.resolve(this.tokens);
  }

  save(tokens: CjTokens): Promise<void> {
    this.tokens = tokens;
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.tokens = null;
    return Promise.resolve();
  }
}
