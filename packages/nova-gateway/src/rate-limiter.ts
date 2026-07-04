// ─── Token Bucket Rate Limiter ───
// Per-key rate limiting with lazy refill

export interface RateLimiterConfig {
  /** Maximum number of tokens in a bucket */
  maxTokens: number;
  /** Number of tokens to add on each refill */
  refillRate: number;
  /** Interval between refills in milliseconds */
  refillIntervalMs: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private config: RateLimiterConfig;
  private buckets = new Map<string, Bucket>();

  constructor(config: RateLimiterConfig) {
    this.config = config;
  }

  /**
   * Try to consume tokens for a key. Returns true if allowed (enough tokens),
   * false if the request should be denied.
   */
  consume(key: string, tokens: number = 1): boolean {
    const bucket = this.getOrCreateBucket(key);
    this.refill(bucket);

    if (bucket.tokens >= tokens) {
      bucket.tokens -= tokens;
      return true;
    }

    return false;
  }

  /**
   * Get the remaining tokens for a key (after applying any pending refills).
   */
  getRemaining(key: string): number {
    const bucket = this.getOrCreateBucket(key);
    this.refill(bucket);
    return bucket.tokens;
  }

  /**
   * Reset a key's bucket back to full tokens.
   */
  reset(key: string): void {
    this.buckets.set(key, {
      tokens: this.config.maxTokens,
      lastRefill: Date.now(),
    });
  }

  /**
   * Lazily refill tokens based on elapsed time since last refill.
   */
  private refill(bucket: Bucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const intervals = Math.floor(elapsed / this.config.refillIntervalMs);

    if (intervals > 0) {
      bucket.tokens = Math.min(
        this.config.maxTokens,
        bucket.tokens + intervals * this.config.refillRate,
      );
      bucket.lastRefill += intervals * this.config.refillIntervalMs;
    }
  }

  /**
   * Get an existing bucket or create a new full one.
   */
  private getOrCreateBucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: this.config.maxTokens,
        lastRefill: Date.now(),
      };
      this.buckets.set(key, bucket);
    }
    return bucket;
  }
}
