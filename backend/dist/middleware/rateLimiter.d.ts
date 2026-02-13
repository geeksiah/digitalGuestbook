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
export declare function rateLimit(opts: RateLimitOptions): (req: any, res: any, next: any) => any;
/**
 * Convenience: per-event + per-IP rate limiter
 */
export declare function perEventRateLimit(opts: Omit<RateLimitOptions, 'keyGenerator'>): (req: any, res: any, next: any) => any;
//# sourceMappingURL=rateLimiter.d.ts.map