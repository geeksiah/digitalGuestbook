"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const validation_js_1 = require("../utils/validation.js");
const phase_js_1 = require("../utils/phase.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const thumbnailGenerator_js_1 = require("../services/thumbnailGenerator.js");
const router = (0, express_1.Router)();
// Configure multer to use memory storage (we'll upload directly to Supabase)
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'video/webm',
            'video/mp4',
            'video/quicktime',
            'audio/webm',
            'audio/mp3',
            'audio/mpeg',
            'audio/wav',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type'));
        }
    },
});
/**
 * Middleware to verify guestbook access
 * @param requireAccessCode - Whether to require access code for invitation-only events (default: true)
 */
const createGuestbookAccessMiddleware = (requireAccessCode = true) => (0, errorHandler_js_1.asyncHandler)(async (req, res, next) => {
    const event = await prisma_js_1.default.event.findFirst({
        where: {
            OR: [
                { id: req.params.eventId },
                { slug: req.params.eventId },
            ],
        },
        // Include booth templates for booth mode
        include: !requireAccessCode ? {
            boothTemplate: true,
            boothVideoTemplate: true,
            boothAudioTemplate: true,
            boothPhotoTemplate: true,
        } : undefined,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not enabled for this event', 400);
    }
    // Verify event is in LIVE phase per SRS Section 9
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    if (!(0, phase_js_1.canAccessGuestbook)(currentPhase)) {
        throw new errorHandler_js_1.AppError('Guestbook is only available during the live event', 400);
    }
    // For invitation-only events, verify guest has valid invitation (unless booth mode)
    // Booth/kiosk mode never requires access code
    // When invitation-only is false, guestbook is accessible without code
    if (event.invitationOnly && requireAccessCode) {
        const { accessCode } = req.query;
        if (!accessCode) {
            throw new errorHandler_js_1.AppError('Access code required for this event', 401);
        }
        const invitation = await prisma_js_1.default.invitation.findFirst({
            where: {
                eventId: event.id,
                accessCode: accessCode,
            },
            include: { rsvp: true },
        });
        if (!invitation || invitation.rsvp.status !== 'APPROVED') {
            throw new errorHandler_js_1.AppError('Invalid or unauthorized access code', 401);
        }
        // Attach invitation to request for reference
        req.invitation = invitation;
    }
    // If invitation-only is false, guestbook is accessible without code (already handled by the condition above)
    req.event = event;
    next();
});
// Standard guestbook access middleware (requires access code for invitation-only events)
const verifyGuestbookAccess = createGuestbookAccessMiddleware(true);
// Booth mode access middleware (no access code required - kiosk mode)
const verifyBoothAccess = createGuestbookAccessMiddleware(false);
/**
 * GET /api/guestbook/:eventId/config
 * Get guestbook configuration for an event
 */
router.get('/:eventId/config', verifyGuestbookAccess, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    res.json({
        config: {
            eventId: event.id,
            eventName: event.name,
            maxRecordingDuration: event.maxRecordingDuration,
            minRecordingDuration: event.minRecordingDuration,
            maxPhotosPerGuest: event.maxPhotosPerGuest,
            invitationOnly: event.invitationOnly,
        },
    });
}));
/**
 * POST /api/guestbook/:eventId/upload
 * Upload media (video, audio, or photo)
 * Per SRS Section 9.2
 */
router.post('/:eventId/upload', verifyGuestbookAccess, upload.single('media'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    const file = req.file;
    if (!file) {
        throw new errorHandler_js_1.AppError('No file uploaded', 400);
    }
    const metadata = validation_js_1.mediaUploadSchema.parse({
        type: req.body.type,
        guestName: req.body.guestName,
        guestEmail: req.body.guestEmail,
        captureMode: req.body.captureMode,
        deviceId: req.body.deviceId,
        duration: req.body.duration ? parseInt(req.body.duration) : undefined,
    });
    // Check photo limits for PERSONAL mode
    if (metadata.type === 'PHOTO' && metadata.captureMode === 'PERSONAL' && metadata.deviceId) {
        const uploadedPhotos = await prisma_js_1.default.mediaAsset.count({
            where: {
                eventId: event.id,
                type: 'PHOTO',
                deviceId: metadata.deviceId,
            },
        });
        if (uploadedPhotos >= event.maxPhotosPerGuest) {
            throw new errorHandler_js_1.AppError(`Maximum ${event.maxPhotosPerGuest} photos allowed per device`, 400);
        }
    }
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path_1.default.extname(file.originalname);
    const fileName = `media-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;
    try {
        // Upload to Supabase Storage
        const { path: storedPath, publicUrl } = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, storagePath, file.buffer, {
            contentType: file.mimetype,
            metadata: {
                eventId: event.id,
                type: metadata.type,
                guestName: metadata.guestName || '',
                originalName: file.originalname,
            },
        });
        // Generate thumbnail for videos
        let thumbnailPath = null;
        if (metadata.type === 'VIDEO') {
            try {
                const thumbnailFileName = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
                const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
                thumbnailPath = await (0, thumbnailGenerator_js_1.generateVideoThumbnailFromBuffer)(file.buffer, thumbnailStoragePath, 1 // Extract frame at 1 second
                );
                console.log(`[Guestbook] Generated thumbnail for video: ${thumbnailPath}`);
            }
            catch (thumbError) {
                console.error('[Guestbook] Failed to generate video thumbnail:', thumbError.message);
                // Continue without thumbnail - video will still be uploaded
            }
        }
        // Create media asset record
        const mediaAsset = await prisma_js_1.default.mediaAsset.create({
            data: {
                eventId: event.id,
                type: metadata.type,
                guestName: metadata.guestName,
                guestEmail: metadata.guestEmail,
                fileName: file.originalname,
                filePath: storedPath, // Store Supabase path
                fileSize: file.size,
                mimeType: file.mimetype,
                duration: metadata.duration,
                captureMode: metadata.captureMode || 'PERSONAL',
                deviceId: metadata.deviceId,
                thumbnailPath: thumbnailPath,
                status: 'READY',
            },
        });
        // Create audit log
        await prisma_js_1.default.auditLog.create({
            data: {
                eventId: event.id,
                action: 'GUESTBOOK_UPLOAD',
                entityType: 'MEDIA',
                entityId: mediaAsset.id,
                details: JSON.stringify({
                    type: metadata.type,
                    guestName: metadata.guestName,
                    captureMode: metadata.captureMode,
                }),
            },
        });
        res.status(201).json({
            message: 'Thank you for your message.',
            mediaAsset: {
                id: mediaAsset.id,
                type: mediaAsset.type,
                status: mediaAsset.status,
            },
        });
    }
    catch (error) {
        console.error('[Guestbook Upload] Supabase upload error:', error);
        throw new errorHandler_js_1.AppError(`Failed to upload file: ${error.message}`, 500);
    }
}));
/**
 * GET /api/guestbook/:eventId/quota
 * Check remaining upload quota for a device
 */
router.get('/:eventId/quota', verifyGuestbookAccess, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    const { deviceId } = req.query;
    if (!deviceId) {
        return res.json({
            quota: {
                photosRemaining: event.maxPhotosPerGuest,
                maxPhotos: event.maxPhotosPerGuest,
            },
        });
    }
    const uploadedPhotos = await prisma_js_1.default.mediaAsset.count({
        where: {
            eventId: event.id,
            type: 'PHOTO',
            deviceId: deviceId,
        },
    });
    res.json({
        quota: {
            photosUploaded: uploadedPhotos,
            photosRemaining: Math.max(0, event.maxPhotosPerGuest - uploadedPhotos),
            maxPhotos: event.maxPhotosPerGuest,
        },
    });
}));
/**
 * GET /api/guestbook/:eventId/booth
 * Get booth mode configuration (no access code required - kiosk mode)
 * UPDATED: Now includes maxPhotosPerSession and shutterCountdown from event settings
 */
router.get('/:eventId/booth', verifyBoothAccess, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    // Helper to format template data
    const formatTemplate = (template) => template ? {
        id: template.id,
        name: template.name,
        htmlContent: template.htmlContent,
        cssContent: template.cssContent,
        jsContent: template.jsContent,
        variables: template.variables,
    } : null;
    res.json({
        booth: {
            eventId: event.id,
            eventName: event.name,
            maxRecordingDuration: event.maxRecordingDuration,
            minRecordingDuration: event.minRecordingDuration,
            // Booth-specific photo limit per session
            maxPhotosPerSession: event.maxPhotosPerBoothSession || 10,
            // Shutter countdown timer
            shutterCountdown: event.boothShutterCountdown || 3,
            // Event branding colors
            primaryColor: event.primaryColor || '#6366f1',
            secondaryColor: event.secondaryColor || '#e0e7ff',
            // Main booth template (for menu/welcome screens)
            template: formatTemplate(event.boothTemplate),
            // Specific page templates
            videoTemplate: formatTemplate(event.boothVideoTemplate),
            audioTemplate: formatTemplate(event.boothAudioTemplate),
            photoTemplate: formatTemplate(event.boothPhotoTemplate),
        },
    });
}));
/**
 * POST /api/guestbook/:eventId/booth/upload
 * Upload media in booth mode (no access code required)
 * UPDATED: Validates photo count per session using session tracking
 */
router.post('/:eventId/booth/upload', verifyBoothAccess, upload.single('media'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    const file = req.file;
    if (!file) {
        throw new errorHandler_js_1.AppError('No media file provided', 400);
    }
    const metadata = validation_js_1.mediaUploadSchema.parse({
        type: req.body.type,
        guestName: req.body.guestName,
        guestEmail: req.body.guestEmail,
        captureMode: 'BOOTH', // Force booth mode
        deviceId: req.body.deviceId,
        duration: req.body.duration ? parseInt(req.body.duration) : undefined,
    });
    // For photos, check session limit (using deviceId + timestamp window)
    if (metadata.type === 'PHOTO' && metadata.deviceId) {
        const sessionWindow = 30 * 60 * 1000; // 30 minute session window
        const sessionStart = new Date(Date.now() - sessionWindow);
        const photosInSession = await prisma_js_1.default.mediaAsset.count({
            where: {
                eventId: event.id,
                type: 'PHOTO',
                captureMode: 'BOOTH',
                deviceId: metadata.deviceId,
                createdAt: { gte: sessionStart },
            },
        });
        const maxPhotosPerSession = event.maxPhotosPerBoothSession || 10;
        if (photosInSession >= maxPhotosPerSession) {
            // With memory storage, no file to delete - just throw error
            throw new errorHandler_js_1.AppError(`Maximum ${maxPhotosPerSession} photos per session. Please start a new session.`, 400);
        }
    }
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path_1.default.extname(file.originalname);
    const fileName = `booth-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;
    try {
        // Upload to Supabase Storage
        const { path: storedPath } = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, storagePath, file.buffer, {
            contentType: file.mimetype,
            metadata: {
                eventId: event.id,
                type: metadata.type,
                guestName: metadata.guestName || 'Booth Guest',
                originalName: file.originalname,
                captureMode: 'BOOTH',
            },
        });
        // Generate thumbnail for videos
        let thumbnailPath = null;
        if (metadata.type === 'VIDEO') {
            try {
                const thumbnailFileName = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
                const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
                thumbnailPath = await (0, thumbnailGenerator_js_1.generateVideoThumbnailFromBuffer)(file.buffer, thumbnailStoragePath, 1 // Extract frame at 1 second
                );
                console.log(`[Booth] Generated thumbnail for video: ${thumbnailPath}`);
            }
            catch (thumbError) {
                console.error('[Booth] Failed to generate video thumbnail:', thumbError.message);
                // Continue without thumbnail - video will still be uploaded
            }
        }
        // Create media asset record
        const mediaAsset = await prisma_js_1.default.mediaAsset.create({
            data: {
                eventId: event.id,
                type: metadata.type,
                guestName: metadata.guestName || 'Booth Guest',
                guestEmail: metadata.guestEmail,
                fileName: file.originalname,
                filePath: storedPath, // Store Supabase path
                fileSize: file.size,
                mimeType: file.mimetype,
                duration: metadata.duration,
                captureMode: 'BOOTH',
                deviceId: metadata.deviceId,
                thumbnailPath: thumbnailPath,
                status: 'READY',
            },
        });
        // Create audit log
        await prisma_js_1.default.auditLog.create({
            data: {
                eventId: event.id,
                action: 'GUESTBOOK_UPLOAD',
                entityType: 'MEDIA',
                entityId: mediaAsset.id,
                details: JSON.stringify({
                    type: metadata.type,
                    captureMode: 'BOOTH',
                    guestName: metadata.guestName,
                    deviceId: metadata.deviceId,
                }),
            },
        });
        res.status(201).json({
            message: 'Media uploaded successfully',
            mediaAsset: {
                id: mediaAsset.id,
                type: mediaAsset.type,
                status: mediaAsset.status,
            },
        });
    }
    catch (error) {
        console.error('[Booth Upload] Supabase upload error:', error);
        throw new errorHandler_js_1.AppError(`Failed to upload file: ${error.message}`, 500);
    }
}));
/**
 * POST /api/guestbook/:eventId/booth/session-qr
 * Generate QR code for downloading all photos from a session
 */
router.post('/:eventId/booth/session-qr', verifyBoothAccess, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = req.event;
    const { deviceId, sessionStart } = req.body;
    if (!deviceId || !sessionStart) {
        throw new errorHandler_js_1.AppError('deviceId and sessionStart are required', 400);
    }
    const sessionStartDate = new Date(sessionStart);
    if (isNaN(sessionStartDate.getTime())) {
        throw new errorHandler_js_1.AppError('Invalid sessionStart date', 400);
    }
    const { generateBoothSessionDownloadQR } = await import('../services/boothDownload.js');
    const qrCodeData = await generateBoothSessionDownloadQR(event.id, deviceId, sessionStartDate);
    res.json({ qrCodeData });
}));
exports.default = router;
//# sourceMappingURL=guestbook.js.map