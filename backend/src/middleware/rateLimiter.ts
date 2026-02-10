// backend/src/middleware/rateLimiter.ts
// ─── Rate-limiting middleware (in-memory, no Redis required) ────────────────
// Uses a simple sliding-window token-bucket per key.
// For production with multiple instances, swap the Map for an Upstash Redis counter.

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now - entry.lastRefill > 300_000) buckets.delete(key);
  }
}, 300_000);

export interface RateLimitOptions {
  /** Max requests allowed in the window */
  max: number;
  /** Window size in milliseconds (default 60 000 = 1 min) */
  windowMs?: number;
  /** Key generator — defaults to IP + path */
  keyGenerator?: (req: any) => string;
  /** Message returned on 429 */
  message?: string;
}

/**
 * Express middleware factory for rate limiting.
 *
 * Usage:
 *   router.post('/upload-url', rateLimit({ max: 20 }), handler);
 */
export function rateLimit(opts: RateLimitOptions) {
  const {
    max,
    windowMs = 60_000,
    keyGenerator = (req: any) => `${req.ip}:${req.baseUrl}${req.path}`,
    message = 'Too many requests, please try again later.',
  } = opts;

  const refillRate = max / (windowMs / 1000); // tokens per second

  return (req: any, res: any, next: any) => {
    const key = keyGenerator(req);
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry) {
      entry = { tokens: max - 1, lastRefill: now };
      buckets.set(key, entry);
      return next();
    }

    // Refill tokens based on elapsed time
    const elapsed = (now - entry.lastRefill) / 1000;
    entry.tokens = Math.min(max, entry.tokens + elapsed * refillRate);
    entry.lastRefill = now;

    if (entry.tokens < 1) {
      res.setHeader('Retry-After', Math.ceil((1 - entry.tokens) / refillRate));
      return res.status(429).json({ error: message });
    }

    entry.tokens -= 1;
    next();
  };
}

/**
 * Convenience: per-event + per-IP rate limiter
 */
export function perEventRateLimit(opts: Omit<RateLimitOptions, 'keyGenerator'>) {
  return rateLimit({
    ...opts,
    keyGenerator: (req: any) =>
      `${req.ip}:${req.params.eventId || 'global'}:${req.baseUrl}${req.path}`,
  });
}