"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteUrl = getSiteUrl;
exports.getApiUrl = getApiUrl;
/**
 * Get the site URL (frontend URL) from environment variables
 * Falls back to localhost only in development
 */
function getSiteUrl() {
    // In production, use FRONTEND_URL or SITE_URL
    const siteUrl = process.env.FRONTEND_URL || process.env.SITE_URL || process.env.APP_URL;
    if (siteUrl) {
        return siteUrl;
    }
    // Only use localhost in development
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }
    // In production without env var, try to construct from request or use a default
    // This should not happen in production, but provides a fallback
    console.warn('[Site URL] FRONTEND_URL, SITE_URL, or APP_URL not set. Using default.');
    return 'https://digitalguestbook.onrender.com';
}
/**
 * Get the API URL from environment variables
 * Falls back to localhost only in development
 */
function getApiUrl() {
    const apiUrl = process.env.API_URL || process.env.BACKEND_URL;
    if (apiUrl) {
        return apiUrl;
    }
    // Only use localhost in development
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3001';
    }
    // In production, construct from site URL or use default
    const siteUrl = getSiteUrl();
    if (siteUrl.includes('localhost')) {
        return 'http://localhost:3001';
    }
    // Assume API is on the same domain or use default
    return siteUrl.replace(/\/$/, '');
}
//# sourceMappingURL=siteUrl.js.map