"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const archiver_1 = __importDefault(require("archiver"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const router = (0, express_1.Router)();
/**
 * GET /api/media/event/:eventId
 * Get all media for an event (Admin or Couple)
 */
router.get('/event/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { type, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = { eventId };
    if (type)
        where.type = type;
    const [media, total] = await Promise.all([
        prisma_js_1.default.mediaAsset.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take,
        }),
        prisma_js_1.default.mediaAsset.count({ where }),
    ]);
    // Transform media to include proper URLs
    const mediaWithUrls = media.map(asset => {
        // If filePath is already a full URL, use it
        let fileUrl = asset.filePath;
        if (!asset.filePath.startsWith('http://') && !asset.filePath.startsWith('https://')) {
            // Check if it's a local storage path
            if (asset.filePath.startsWith('/storage/')) {
                fileUrl = asset.filePath; // Will be served as static file
            }
            else {
                // Try to get Supabase URL
                try {
                    fileUrl = (0, supabaseStorage_js_1.getPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, asset.filePath);
                }
                catch {
                    // Fallback to local path
                    fileUrl = asset.filePath.startsWith('/') ? asset.filePath : `/${asset.filePath}`;
                }
            }
        }
        // Handle thumbnail URL similarly
        let thumbnailUrl = asset.thumbnailPath;
        if (asset.thumbnailPath && !asset.thumbnailPath.startsWith('http://') && !asset.thumbnailPath.startsWith('https://')) {
            if (asset.thumbnailPath.startsWith('/storage/')) {
                thumbnailUrl = asset.thumbnailPath;
            }
            else {
                try {
                    thumbnailUrl = (0, supabaseStorage_js_1.getPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, asset.thumbnailPath);
                }
                catch {
                    thumbnailUrl = asset.thumbnailPath.startsWith('/') ? asset.thumbnailPath : `/${asset.thumbnailPath}`;
                }
            }
        }
        return {
            ...asset,
            filePath: fileUrl,
            thumbnailPath: thumbnailUrl,
        };
    });
    res.json({
        media: mediaWithUrls,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / take),
        },
    });
}));
/**
 * GET /api/media/:id
 * Get single media asset details
 */
router.get('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const mediaAsset = await prisma_js_1.default.mediaAsset.findUnique({
        where: { id: req.params.id },
        include: {
            event: { select: { id: true, name: true, slug: true } },
        },
    });
    if (!mediaAsset) {
        throw new errorHandler_js_1.AppError('Media asset not found', 404);
    }
    res.json({ mediaAsset });
}));
/**
 * GET /api/media/:id/download
 * Download a single media file
 * Handles both Supabase and local filesystem storage
 */
router.get('/:id/download', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const mediaAsset = await prisma_js_1.default.mediaAsset.findUnique({
        where: { id: req.params.id },
    });
    if (!mediaAsset) {
        throw new errorHandler_js_1.AppError('Media asset not found', 404);
    }
    // Check if filePath is a Supabase URL
    if (mediaAsset.filePath.startsWith('http://') || mediaAsset.filePath.startsWith('https://')) {
        // Supabase URL - redirect to the URL
        res.redirect(mediaAsset.filePath);
        return;
    }
    // Download from Supabase Storage
    try {
        // filePath format from Supabase: "eventId/filename.jpg"
        const fileBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.MEDIA, mediaAsset.filePath);
        res.setHeader('Content-Disposition', `attachment; filename="${mediaAsset.fileName}"`);
        res.setHeader('Content-Type', mediaAsset.mimeType || 'application/octet-stream');
        res.send(fileBuffer);
    }
    catch (error) {
        console.error('[Media] Failed to download from Supabase:', error.message);
        throw new errorHandler_js_1.AppError('File not found on server', 404);
    }
}));
/**
 * GET /api/media/event/:eventId/download-all
 * Download all media as ZIP
 * Per SRS Section 10
 */
router.get('/event/:eventId/download-all', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const mediaAssets = await prisma_js_1.default.mediaAsset.findMany({
        where: { eventId },
    });
    if (mediaAssets.length === 0) {
        throw new errorHandler_js_1.AppError('No media assets found for this event', 404);
    }
    // Set up ZIP response
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${event.slug}-media-${Date.now()}.zip"`);
    const archive = (0, archiver_1.default)('zip', { zlib: { level: 5 } });
    archive.on('error', (err) => {
        throw err;
    });
    archive.pipe(res);
    // Add files to archive organized by type
    for (const asset of mediaAssets) {
        try {
            // Download file from Supabase
            const fileBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.MEDIA, asset.filePath);
            const folder = asset.type.toLowerCase();
            const fileName = asset.guestName
                ? `${asset.guestName}-${asset.fileName}`
                : asset.fileName;
            archive.append(fileBuffer, { name: `${folder}/${fileName}` });
        }
        catch (error) {
            console.warn(`[Media] ZIP: Failed to download ${asset.filePath}:`, error.message);
            // Continue with other files
        }
    }
    await archive.finalize();
}));
/**
 * DELETE /api/media/:id
 * Delete a media asset (Admin only)
 */
router.delete('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const mediaAsset = await prisma_js_1.default.mediaAsset.findUnique({
        where: { id: req.params.id },
    });
    if (!mediaAsset) {
        throw new errorHandler_js_1.AppError('Media asset not found', 404);
    }
    // Delete file from Supabase Storage
    try {
        await (0, supabaseStorage_js_1.deleteFromSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, mediaAsset.filePath);
    }
    catch (error) {
        console.warn(`[Media] Failed to delete file from Supabase: ${error.message}`);
    }
    // Delete thumbnail from Supabase Storage if exists
    if (mediaAsset.thumbnailPath) {
        try {
            await (0, supabaseStorage_js_1.deleteFromSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, mediaAsset.thumbnailPath);
        }
        catch (error) {
            console.warn(`[Media] Failed to delete thumbnail from Supabase: ${error.message}`);
        }
    }
    // Delete database record
    await prisma_js_1.default.mediaAsset.delete({
        where: { id: req.params.id },
    });
    // Audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: mediaAsset.eventId,
            adminId: req.admin.id,
            action: 'MEDIA_DELETED',
            entityType: 'MEDIA',
            entityId: mediaAsset.id,
            details: JSON.stringify({
                type: mediaAsset.type,
                fileName: mediaAsset.fileName,
            }),
        },
    });
    res.json({ message: 'Media asset deleted successfully' });
}));
/**
 * GET /api/media/event/:eventId/timeline
 * Get media timeline for display
 */
router.get('/event/:eventId/timeline', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { limit = '100' } = req.query;
    const media = await prisma_js_1.default.mediaAsset.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        select: {
            id: true,
            type: true,
            guestName: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            duration: true,
            captureMode: true,
            thumbnailPath: true,
            createdAt: true,
        },
    });
    res.json({ media });
}));
/**
 * GET /api/media/event/:eventId/stats
 * Get media statistics
 */
router.get('/event/:eventId/stats', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const [total, byType, byMode, totalSize, totalDuration,] = await Promise.all([
        prisma_js_1.default.mediaAsset.count({ where: { eventId } }),
        prisma_js_1.default.mediaAsset.groupBy({
            by: ['type'],
            where: { eventId },
            _count: true,
        }),
        prisma_js_1.default.mediaAsset.groupBy({
            by: ['captureMode'],
            where: { eventId },
            _count: true,
        }),
        prisma_js_1.default.mediaAsset.aggregate({
            where: { eventId },
            _sum: { fileSize: true },
        }),
        prisma_js_1.default.mediaAsset.aggregate({
            where: { eventId, type: { in: ['VIDEO', 'AUDIO'] } },
            _sum: { duration: true },
        }),
    ]);
    res.json({
        stats: {
            total,
            byType: byType.reduce((acc, item) => {
                acc[item.type.toLowerCase()] = item._count;
                return acc;
            }, {}),
            byMode: byMode.reduce((acc, item) => {
                acc[item.captureMode.toLowerCase()] = item._count;
                return acc;
            }, {}),
            totalSizeBytes: totalSize._sum.fileSize || 0,
            totalSizeMB: Math.round((totalSize._sum.fileSize || 0) / (1024 * 1024) * 100) / 100,
            totalDurationSeconds: totalDuration._sum.duration || 0,
        },
    });
}));
/**
 * POST /api/media/event/:eventId/generate-reel
 * Generate a reel from event media (videos)
 */
router.post('/event/:eventId/generate-reel', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { maxDuration = 300 } = req.body;
    // Check if event exists and has reel enabled
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.reelEnabled) {
        throw new errorHandler_js_1.AppError('Reel generation is not enabled for this event', 400);
    }
    // Get all video assets for the event
    const videos = await prisma_js_1.default.mediaAsset.findMany({
        where: { eventId, type: 'VIDEO' },
        orderBy: { createdAt: 'asc' },
    });
    if (videos.length === 0) {
        throw new errorHandler_js_1.AppError('No videos available for reel generation', 400);
    }
    // Import reel generator service
    const { generateReel, checkFfmpegAvailable } = await import('../services/reelGenerator.js');
    // Check if ffmpeg is available
    const ffmpegAvailable = await checkFfmpegAvailable();
    if (!ffmpegAvailable) {
        throw new errorHandler_js_1.AppError('FFmpeg is not installed on the server. Reel generation is unavailable.', 503);
    }
    // Start reel generation
    const jobId = await generateReel({
        eventId,
        outputName: `${event.slug}-reel`,
        maxDuration,
    });
    // Audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
            action: 'REEL_GENERATION_REQUESTED',
            entityType: 'MEDIA',
            details: JSON.stringify({
                jobId,
                videoCount: videos.length,
                totalDuration: videos.reduce((sum, v) => sum + (v.duration || 0), 0),
            }),
        },
    });
    res.json({
        message: 'Reel generation started',
        jobId,
        status: 'processing',
        details: {
            videoCount: videos.length,
            totalDuration: videos.reduce((sum, v) => sum + (v.duration || 0), 0),
            estimatedTime: Math.ceil(videos.reduce((sum, v) => sum + (v.duration || 0), 0) * 0.5),
        },
    });
}));
/**
 * GET /api/media/reel/:jobId/status
 * Get reel generation job status
 */
router.get('/reel/:jobId/status', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { jobId } = req.params;
    const { getReelJobStatus } = await import('../services/reelGenerator.js');
    const status = await getReelJobStatus(jobId);
    if (!status) {
        throw new errorHandler_js_1.AppError('Job not found', 404);
    }
    res.json({ job: status });
}));
exports.default = router;
//# sourceMappingURL=media.js.map