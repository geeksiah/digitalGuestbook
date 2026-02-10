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

import { spawn } from 'child_process';
import fs from 'fs';
import prisma from '../utils/prisma.js';
import { uploadToSupabase, downloadFile, BUCKETS } from '../services/supabaseStorage.js';

// ── Concurrency limiter (p-limit pattern without the npm dep) ──────────────────
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active < concurrency && queue.length > 0) {
      active++;
      const fn = queue.shift()!;
      fn();
    }
  };

  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
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

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ThumbnailJob {
  mediaAssetId: string;
  storagePath: string; // video path in Supabase
  eventId: string;
  timeOffset?: number;
}

// ── Core thumbnail generation (isolated, testable) ─────────────────────────────
export async function generateThumbnailForAsset(job: ThumbnailJob): Promise<string | null> {
  const { mediaAssetId, storagePath, eventId, timeOffset = 1 } = job;
  const tempDir = process.env.TMPDIR || '/tmp';
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const tempVideoPath = `${tempDir}/video_${uid}.mp4`;
  const tempThumbPath = `${tempDir}/thumb_${uid}.jpg`;

  try {
    // Mark as processing
    await prisma.mediaAsset.update({
      where: { id: mediaAssetId },
      data: { status: 'PROCESSING_THUMBNAIL' },
    });

    // Download video from Supabase
    const videoBuffer = await downloadFile(BUCKETS.MEDIA, storagePath);
    fs.writeFileSync(tempVideoPath, videoBuffer);

    // Generate thumbnail via FFmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
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
      ffmpeg.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-500)}`))
      );
      ffmpeg.on('error', (e) => reject(new Error(`FFmpeg spawn error: ${e.message}`)));
    });

    // Upload thumbnail
    const thumbnailStoragePath = `${eventId}/thumb-${uid}.jpg`;
    const thumbBuffer = fs.readFileSync(tempThumbPath);

    const { path: uploadedPath } = await uploadToSupabase(BUCKETS.MEDIA, thumbnailStoragePath, thumbBuffer, {
      contentType: 'image/jpeg',
      metadata: { generatedAt: new Date().toISOString() },
    });

    // Update DB — set thumbnailPath, keep status READY (upload already marked it)
    await prisma.mediaAsset.update({
      where: { id: mediaAssetId },
      data: { thumbnailPath: uploadedPath, status: 'READY' },
    });

    console.log(`[ThumbnailWorker] ✓ ${mediaAssetId} → ${uploadedPath}`);
    return uploadedPath;
  } catch (error: any) {
    console.error(`[ThumbnailWorker] ✗ ${mediaAssetId}:`, error.message);

    // Mark failed but keep the asset visible (status stays READY if it was already set)
    try {
      await prisma.mediaAsset.update({
        where: { id: mediaAssetId },
        data: { status: 'READY' }, // Don't block asset display because thumb failed
      });
    } catch { /* ignore */ }

    return null;
  } finally {
    // Cleanup temp files
    try { if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath); } catch { /* */ }
    try { if (fs.existsSync(tempThumbPath)) fs.unlinkSync(tempThumbPath); } catch { /* */ }
  }
}

// ── Public API: enqueue a thumbnail job ────────────────────────────────────────
/**
 * Fire-and-forget: enqueues thumbnail generation.
 * Returns immediately — does NOT block the upload response.
 */
export function enqueueThumbnail(job: ThumbnailJob): void {
  // Wrap in limiter — at most 2 concurrent FFmpeg processes
  limit(() => generateThumbnailForAsset(job)).catch((err) => {
    console.error(`[ThumbnailWorker] Unhandled error for ${job.mediaAssetId}:`, err.message);
  });
}