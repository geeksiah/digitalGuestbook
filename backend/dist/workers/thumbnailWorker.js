"use strict";
// backend/src/workers/thumbnailWorker.ts
// ─── Background thumbnail generation with concurrency control ───────────────
//
// This module provides two modes:
//   1. In-process deferred queue (default) — uses p-limit to cap FFmpeg concurrency
//   2. BullMQ + Redis (opt-in) — for multi-instance deployments
//
// Usage from upload handler:
//   import { enqueueThumbnail } from '../workers/thumbnailWorker.js';
//   enqueueThumbnail({ mediaAssetId, storagePath, eventId });
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateThumbnailForAsset = generateThumbnailForAsset;
exports.enqueueThumbnail = enqueueThumbnail;
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
// ── Concurrency limiter (p-limit pattern without the npm dep) ──────────────────
function createLimiter(concurrency) {
    let active = 0;
    const queue = [];
    const next = () => {
        if (active < concurrency && queue.length > 0) {
            active++;
            const fn = queue.shift();
            fn();
        }
    };
    return (fn) => new Promise((resolve, reject) => {
        const run = () => {
            fn()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                active--;
                next();
            });
        };
        queue.push(run);
        next();
    });
}
// Max 2 concurrent FFmpeg processes to avoid CPU/memory spikes
const limit = createLimiter(2);
// ── Core thumbnail generation (isolated, testable) ─────────────────────────────
async function generateThumbnailForAsset(job) {
    const { mediaAssetId, storagePath, eventId, timeOffset = 1 } = job;
    const tempDir = process.env.TMPDIR || '/tmp';
    const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tempVideoPath = `${tempDir}/video_${uid}.mp4`;
    const tempThumbPath = `${tempDir}/thumb_${uid}.jpg`;
    try {
        // Mark as processing
        await prisma_js_1.default.mediaAsset.update({
            where: { id: mediaAssetId },
            data: { status: 'PROCESSING_THUMBNAIL' },
        });
        // Download video from Supabase
        const videoBuffer = await (0, supabaseStorage_js_1.downloadFile)(supabaseStorage_js_1.BUCKETS.MEDIA, storagePath);
        fs_1.default.writeFileSync(tempVideoPath, videoBuffer);
        // Generate thumbnail via FFmpeg
        await new Promise((resolve, reject) => {
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', [
                '-i', tempVideoPath,
                '-ss', timeOffset.toString(),
                '-vframes', '1',
                '-vf', 'scale=640:-1',
                '-q:v', '2',
                '-y',
                tempThumbPath,
            ]);
            let stderr = '';
            ffmpeg.stderr.on('data', (d) => (stderr += d.toString()));
            ffmpeg.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`)));
            ffmpeg.on('error', (e) => reject(new Error(`FFmpeg spawn error: ${e.message}`)));
        });
        // Upload thumbnail
        const thumbnailStoragePath = `${eventId}/thumb-${uid}.jpg`;
        const thumbBuffer = fs_1.default.readFileSync(tempThumbPath);
        const { path: uploadedPath } = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, thumbnailStoragePath, thumbBuffer, {
            contentType: 'image/jpeg',
            metadata: { generatedAt: new Date().toISOString() },
        });
        // Update DB — set thumbnailPath, keep status READY (upload already marked it)
        await prisma_js_1.default.mediaAsset.update({
            where: { id: mediaAssetId },
            data: { thumbnailPath: uploadedPath, status: 'READY' },
        });
        console.log(`[ThumbnailWorker] ✓ ${mediaAssetId} → ${uploadedPath}`);
        return uploadedPath;
    }
    catch (error) {
        console.error(`[ThumbnailWorker] ✗ ${mediaAssetId}:`, error.message);
        // Mark failed but keep the asset visible (status stays READY if it was already set)
        try {
            await prisma_js_1.default.mediaAsset.update({
                where: { id: mediaAssetId },
                data: { status: 'READY' }, // Don't block asset display because thumb failed
            });
        }
        catch { /* ignore */ }
        return null;
    }
    finally {
        // Cleanup temp files
        try {
            if (fs_1.default.existsSync(tempVideoPath))
                fs_1.default.unlinkSync(tempVideoPath);
        }
        catch { /* */ }
        try {
            if (fs_1.default.existsSync(tempThumbPath))
                fs_1.default.unlinkSync(tempThumbPath);
        }
        catch { /* */ }
    }
}
// ── Public API: enqueue a thumbnail job ────────────────────────────────────────
/**
 * Fire-and-forget: enqueues thumbnail generation.
 * Returns immediately — does NOT block the upload response.
 */
function enqueueThumbnail(job) {
    // Wrap in limiter — at most 2 concurrent FFmpeg processes
    limit(() => generateThumbnailForAsset(job)).catch((err) => {
        console.error(`[ThumbnailWorker] Unhandled error for ${job.mediaAssetId}:`, err.message);
    });
}
//# sourceMappingURL=thumbnailWorker.js.map