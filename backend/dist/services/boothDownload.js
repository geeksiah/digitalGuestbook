"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBoothSessionDownloadToken = generateBoothSessionDownloadToken;
exports.generateBoothSessionDownloadQR = generateBoothSessionDownloadQR;
exports.generateBoothDownloadToken = generateBoothDownloadToken;
exports.generateBoothDownloadQR = generateBoothDownloadQR;
exports.verifyBoothDownloadToken = verifyBoothDownloadToken;
exports.getSessionPhotos = getSessionPhotos;
const crypto_1 = require("crypto");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const qrcode_1 = __importDefault(require("qrcode"));
const siteUrl_js_1 = require("../utils/siteUrl.js");
/**
 * Generate a secure download token for a booth photo session (all photos from a session)
 */
async function generateBoothSessionDownloadToken(eventId, deviceId, sessionStart) {
    const sessionId = `${deviceId}-${sessionStart.getTime()}`;
    // Check if token already exists for this session
    const existing = await prisma_js_1.default.boothDownloadToken.findFirst({
        where: {
            sessionId,
            eventId,
            deviceId,
            expiresAt: { gt: new Date() },
            used: false,
        },
    });
    if (existing) {
        return existing.token;
    }
    // Generate secure random token
    const token = (0, crypto_1.randomBytes)(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    // Create token for session
    await prisma_js_1.default.boothDownloadToken.create({
        data: {
            eventId,
            deviceId,
            sessionId,
            token,
            expiresAt,
        },
    });
    return token;
}
/**
 * Generate QR code for booth photo session download
 */
async function generateBoothSessionDownloadQR(eventId, deviceId, sessionStart) {
    const token = await generateBoothSessionDownloadToken(eventId, deviceId, sessionStart);
    const siteUrl = (0, siteUrl_js_1.getSiteUrl)();
    const downloadUrl = `${siteUrl}/booth/download/${token}`;
    // Generate QR code as data URL
    const qrCodeData = await qrcode_1.default.toDataURL(downloadUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#1a1a2e',
            light: '#ffffff',
        },
    });
    return qrCodeData;
}
/**
 * Generate a secure download token for a single booth photo (backward compatibility)
 */
async function generateBoothDownloadToken(mediaId) {
    // Check if token already exists
    const existing = await prisma_js_1.default.boothDownloadToken.findFirst({
        where: { mediaId },
    });
    if (existing && existing.expiresAt > new Date() && !existing.used) {
        return existing.token;
    }
    // Get media to get eventId
    const media = await prisma_js_1.default.mediaAsset.findUnique({
        where: { id: mediaId },
        select: { eventId: true },
    });
    if (!media) {
        throw new Error('Media not found');
    }
    // Generate secure random token
    const token = (0, crypto_1.randomBytes)(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiration
    // Create or update token
    await prisma_js_1.default.boothDownloadToken.upsert({
        where: { mediaId: mediaId || '' },
        create: {
            mediaId,
            eventId: media.eventId,
            token,
            expiresAt,
        },
        update: {
            token,
            expiresAt,
            used: false,
            usedAt: null,
        },
    });
    return token;
}
/**
 * Generate QR code for single booth photo download (backward compatibility)
 */
async function generateBoothDownloadQR(mediaId) {
    const token = await generateBoothDownloadToken(mediaId);
    const siteUrl = (0, siteUrl_js_1.getSiteUrl)();
    const downloadUrl = `${siteUrl}/booth/download/${token}`;
    // Generate QR code as data URL
    const qrCodeData = await qrcode_1.default.toDataURL(downloadUrl, {
        width: 300,
        margin: 2,
        color: {
            dark: '#1a1a2e',
            light: '#ffffff',
        },
    });
    return qrCodeData;
}
/**
 * Verify and get download token info (for session-based downloads)
 * Note: Token is NOT marked as used here - it's marked when individual photos are downloaded
 */
async function verifyBoothDownloadToken(token, markAsUsed = false) {
    const downloadToken = await prisma_js_1.default.boothDownloadToken.findUnique({
        where: { token },
    });
    if (!downloadToken) {
        return null;
    }
    // Check if token is expired
    if (downloadToken.expiresAt < new Date()) {
        return null;
    }
    // Check if token has been used (only if markAsUsed is true)
    if (markAsUsed && downloadToken.used) {
        return null;
    }
    // Mark as used if requested
    if (markAsUsed) {
        await prisma_js_1.default.boothDownloadToken.update({
            where: { token },
            data: {
                used: true,
                usedAt: new Date(),
            },
        });
    }
    // If sessionId exists, it's a session-based download
    if (downloadToken.sessionId) {
        return {
            type: 'session',
            sessionId: downloadToken.sessionId,
            eventId: downloadToken.eventId,
            deviceId: downloadToken.deviceId || undefined,
        };
    }
    // Otherwise, it's a single photo download
    if (downloadToken.mediaId) {
        const media = await prisma_js_1.default.mediaAsset.findUnique({
            where: { id: downloadToken.mediaId },
            select: {
                id: true,
                filePath: true,
                fileName: true,
                type: true,
                captureMode: true,
            },
        });
        if (!media || media.captureMode !== 'BOOTH') {
            return null;
        }
        return {
            type: 'single',
            mediaId: media.id,
            filePath: media.filePath,
        };
    }
    return null;
}
/**
 * Get all photos for a session
 */
async function getSessionPhotos(sessionId, eventId, deviceId) {
    // Parse session start time from sessionId (format: deviceId-timestamp)
    const parts = sessionId.split('-');
    if (parts.length < 2) {
        return [];
    }
    const sessionStartTime = parseInt(parts[parts.length - 1]);
    if (isNaN(sessionStartTime)) {
        return [];
    }
    const sessionStart = new Date(sessionStartTime);
    const sessionWindow = 30 * 60 * 1000; // 30 minute session window
    const sessionEnd = new Date(sessionStart.getTime() + sessionWindow);
    // Find all photos in this session
    const photos = await prisma_js_1.default.mediaAsset.findMany({
        where: {
            eventId,
            type: 'PHOTO',
            captureMode: 'BOOTH',
            deviceId: deviceId || undefined,
            createdAt: {
                gte: sessionStart,
                lte: sessionEnd,
            },
        },
        select: {
            id: true,
            filePath: true,
            fileName: true,
        },
        orderBy: {
            createdAt: 'asc',
        },
    });
    return photos;
}
//# sourceMappingURL=boothDownload.js.map