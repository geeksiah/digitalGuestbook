/**
 * Where the guest-facing app lives.
 *
 * Every link that leaves the server (emails, WhatsApp, MC control links, QR
 * targets) has to be absolute, so these helpers never return a bare path.
 */
/**
 * Get the site URL (frontend URL) from environment variables.
 * Falls back to localhost only in development.
 */
export declare function getSiteUrl(): string;
/**
 * Absolute URL for a path on the guest-facing app.
 * Use this instead of string-concatenating an env var.
 */
export declare function buildSiteUrl(path: string): string;
/**
 * A connected custom domain serves the event once DNS verification passes, so
 * both ACTIVE and VERIFIED hosts are already routable. Mirrors the rule in
 * `GET /api/public/domain/:host` and the frontend middleware.
 */
type EventDomainLike = {
    host: string;
    status: string;
    isPrimary?: boolean;
};
export declare function pickLiveEventDomain<T extends EventDomainLike>(domains: T[] | null | undefined): T | null;
/**
 * Base URL a guest should see for an event: its own domain when one is
 * connected, otherwise the shared app host.
 */
export declare function getEventPublicBaseUrl(domains: EventDomainLike[] | null | undefined): string;
/**
 * Absolute URL for one of an event's guest pages.
 *
 * On a connected domain the hostname already identifies the event, so the
 * `/e/<slug>` prefix is dropped to match how the frontend middleware rewrites
 * incoming requests.
 */
export declare function buildEventPublicUrl(slug: string, path: string, domains?: EventDomainLike[] | null): string;
/**
 * Get the API URL from environment variables.
 * Falls back to localhost only in development.
 */
export declare function getApiUrl(): string;
export {};
//# sourceMappingURL=siteUrl.d.ts.map