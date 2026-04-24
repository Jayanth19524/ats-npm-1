import type { NextFunction, Request, Response } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const now = Date.now();
    const key = options.keyGenerator?.(req) ?? req.ip ?? "unknown";
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    // Opportunistic cleanup keeps the in-memory map bounded without timers.
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - bucket.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ error: options.message ?? "Too many requests. Please try again later." });
      return;
    }

    next();
  };
}

interface ConcurrencyLimitOptions {
  max: number;
  message?: string;
}

export function createConcurrencyLimiter(options: ConcurrencyLimitOptions) {
  let active = 0;

  return function concurrencyLimit(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (active >= options.max) {
      res.status(503).json({ error: options.message ?? "Server is busy. Please try again shortly." });
      return;
    }

    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };

    res.once("finish", release);
    res.once("close", release);
    next();
  };
}
