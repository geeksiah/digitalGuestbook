import { Router } from 'express';
import archiver from 'archiver';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin, authenticateCouple } from '../middleware/auth.js';
import { downloadFile, BUCKETS, getPublicUrl, deleteFromSupabase } from '../services/supabaseStorage.js';

const router = Router();

/**
 * GET /api/media/event/:eventId
 * Get all media for an event (Admin or Couple)
 */
router.get('/event/:eventId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { type, page = '1', limit = '50' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { 
    eventId,
    captureMode: { not: 'BOOTH' }, // Exclude booth mode photos from media listings
  };
  if (type) where.type = type;

  const [media, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.mediaAsset.count({ where }),
  ]);

  // Transform media to include proper URLs
  const mediaWithUrls = media.map(asset => {
    // If filePath is already a full URL, use it
    let fileUrl = asset.filePath;
    if (!asset.filePath.startsWith('http://') && !asset.filePath.startsWith('https://')) {
      // Check if it's a local storage path
      if (asset.filePath.startsWith('/storage/')) {
        fileUrl = asset.filePath; // Will be served as static file
      } else {
        // Try to get Supabase URL
        try {
          fileUrl = getPublicUrl(BUCKETS.MEDIA, asset.filePath);
        } catch {
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
      } else {
        try {
          thumbnailUrl = getPublicUrl(BUCKETS.MEDIA, asset.thumbnailPath);
        } catch {
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
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / take),
    },
  });
}));

/**
 * GET /api/media/:id
 * Get single media asset details
 */
router.get('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: req.params.id },
    include: {
      event: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!mediaAsset) {
    throw new AppError('Media asset not found', 404);
  }

  res.json({ mediaAsset });
}));

/**
 * GET /api/media/:id/download
 * Download a single media file
 * Handles both Supabase and local filesystem storage
 * Supports both admin token and owner token via header
 */
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Support both admin token and owner token
  const authHeader = req.headers.authorization;
  // Check both lowercase and capitalized header names
  const ownerToken = (req.headers['x-owner-token'] || req.headers['X-Owner-Token']) as string | undefined;
  
  console.log('[Media Download] Request for media:', id, 'Auth header present:', !!authHeader, 'Owner token present:', !!ownerToken);
  
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id },
    include: { event: { select: { id: true, ownerId: true, ownerAccessToken: true } } },
  });

  if (!mediaAsset) {
    throw new AppError('Media asset not found', 404);
  }

  // Verify authentication
  let isAuthorized = false;
  
  if (ownerToken) {
    // If owner token (access token from event-owner portal), verify it matches this event
    if (mediaAsset.event.ownerAccessToken === ownerToken) {
      isAuthorized = true;
      console.log('[Media Download] Authorized via owner access token');
    } else {
      console.log('[Media Download] Owner access token mismatch');
      throw new AppError('Unauthorized', 401);
    }
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // Verify token - could be admin or owner JWT token
    const jwt = await import('jsonwebtoken');
    try {
      const token = authHeader.replace('Bearer ', '');
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      console.log('[Media Download] JWT decoded:', { ownerId: decoded.ownerId, adminId: decoded.adminId });
      
      // Check if it's an owner JWT token
      if (decoded.ownerId) {
        // Owner JWT token - verify they own this event
        if (mediaAsset.event.ownerId === decoded.ownerId) {
          isAuthorized = true;
          console.log('[Media Download] Authorized via owner JWT token');
        } else {
          console.log('[Media Download] Owner JWT token - ownerId mismatch. Event owner:', mediaAsset.event.ownerId, 'Token owner:', decoded.ownerId);
          throw new AppError('Unauthorized - You do not have access to this event', 401);
        }
      } else if (decoded.adminId) {
        // Admin token - allow access (no additional check needed)
        isAuthorized = true;
        console.log('[Media Download] Authorized via admin JWT token');
      } else {
        console.log('[Media Download] JWT token missing ownerId or adminId');
        throw new AppError('Unauthorized - Invalid token', 401);
      }
    } catch (error: any) {
      console.error('[Media Download] JWT verification error:', error.message);
      if (error.message?.includes('Unauthorized')) {
        throw error;
      }
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new AppError('Unauthorized - Invalid or expired token', 401);
      }
      throw new AppError('Unauthorized', 401);
    }
  } else {
    console.log('[Media Download] No authentication provided');
    throw new AppError('Unauthorized', 401);
  }

  if (!isAuthorized) {
    throw new AppError('Unauthorized', 401);
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
    const fileBuffer = await downloadFile(BUCKETS.MEDIA, mediaAsset.filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${mediaAsset.fileName}"`);
    res.setHeader('Content-Type', mediaAsset.mimeType || 'application/octet-stream');
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('[Media] Failed to download from Supabase:', error.message);
    throw new AppError('File not found on server', 404);
  }
}));

/**
 * GET /api/media/event/:eventId/download-all
 * Download all media as ZIP
 * Per SRS Section 10
 * Supports both admin auth and owner token via header
 */
router.get('/event/:eventId/download-all', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  
  // Support both admin token and owner token
  const authHeader = req.headers.authorization;
  // Check both lowercase and capitalized header names
  const ownerToken = (req.headers['x-owner-token'] || req.headers['X-Owner-Token']) as string | undefined;
  
  console.log('[Media Download All] Request for event:', eventId, 'Auth header present:', !!authHeader, 'Owner token present:', !!ownerToken);
  
  let event;
  if (ownerToken) {
    // If owner token (access token from event-owner portal), verify it matches this event
    event = await prisma.event.findFirst({
      where: { id: eventId, ownerAccessToken: ownerToken },
    });
    if (!event) {
      console.log('[Media Download All] Owner access token mismatch for event:', eventId);
      throw new AppError('Unauthorized', 401);
    }
    console.log('[Media Download All] Authorized via owner access token');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    // Verify token - could be admin or owner token
    const jwt = await import('jsonwebtoken');
    try {
      const token = authHeader.replace('Bearer ', '');
      const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
      const decoded = jwt.verify(token, jwtSecret) as any;
      
      // Check if it's an owner token
      if (decoded.ownerId) {
        // Owner token - verify they own this event
        event = await prisma.event.findFirst({
          where: { id: eventId, ownerId: decoded.ownerId },
        });
        if (!event) {
          throw new AppError('Unauthorized - You do not have access to this event', 401);
        }
      } else {
        // Admin token - allow access to any event
        event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) {
          throw new AppError('Event not found', 404);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('Unauthorized')) {
        throw error;
      }
      throw new AppError('Unauthorized', 401);
    }
  } else {
    throw new AppError('Unauthorized', 401);
  }

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: { 
      eventId,
      captureMode: { not: 'BOOTH' }, // Exclude booth mode photos from download-all
    },
  });

  if (mediaAssets.length === 0) {
    throw new AppError('No media assets found for this event', 404);
  }

  // Set up ZIP response
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${event.slug}-media-${Date.now()}.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 5 } });
  
  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(res);

  // Add files to archive organized by type
  for (const asset of mediaAssets) {
    try {
      // Download file from Supabase
      const fileBuffer = await downloadFile(BUCKETS.MEDIA, asset.filePath);
      
      const folder = asset.type.toLowerCase();
      const fileName = asset.guestName
        ? `${asset.guestName}-${asset.fileName}`
        : asset.fileName;
      
      archive.append(fileBuffer, { name: `${folder}/${fileName}` });
    } catch (error: any) {
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
router.delete('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: req.params.id },
  });

  if (!mediaAsset) {
    throw new AppError('Media asset not found', 404);
  }

  // Delete file from Supabase Storage
  try {
    await deleteFromSupabase(BUCKETS.MEDIA, mediaAsset.filePath);
  } catch (error: any) {
    console.warn(`[Media] Failed to delete file from Supabase: ${error.message}`);
  }

  // Delete thumbnail from Supabase Storage if exists
  if (mediaAsset.thumbnailPath) {
    try {
      await deleteFromSupabase(BUCKETS.MEDIA, mediaAsset.thumbnailPath);
    } catch (error: any) {
      console.warn(`[Media] Failed to delete thumbnail from Supabase: ${error.message}`);
    }
  }

  // Delete database record
  await prisma.mediaAsset.delete({
    where: { id: req.params.id },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId: mediaAsset.eventId,
      adminId: req.admin!.id,
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
router.get('/event/:eventId/timeline', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { limit = '100' } = req.query;

  const media = await prisma.mediaAsset.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
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
router.get('/event/:eventId/stats', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const [
    total,
    byType,
    byMode,
    totalSize,
    totalDuration,
  ] = await Promise.all([
    prisma.mediaAsset.count({ where: { eventId } }),
    prisma.mediaAsset.groupBy({
      by: ['type'],
      where: { eventId },
      _count: true,
    }),
    prisma.mediaAsset.groupBy({
      by: ['captureMode'],
      where: { eventId },
      _count: true,
    }),
    prisma.mediaAsset.aggregate({
      where: { eventId },
      _sum: { fileSize: true },
    }),
    prisma.mediaAsset.aggregate({
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
      }, {} as Record<string, number>),
      byMode: byMode.reduce((acc, item) => {
        acc[item.captureMode.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>),
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
router.post('/event/:eventId/generate-reel', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { maxDuration = 300 } = req.body;

  // Check if event exists and has reel enabled
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.reelEnabled) {
    throw new AppError('Reel generation is not enabled for this event', 400);
  }

  // Get all video assets for the event
  const videos = await prisma.mediaAsset.findMany({
    where: { eventId, type: 'VIDEO' },
    orderBy: { createdAt: 'asc' },
  });

  if (videos.length === 0) {
    throw new AppError('No videos available for reel generation', 400);
  }

  // Import reel generator service
  const { generateReel, checkFfmpegAvailable } = await import('../services/reelGenerator.js');

  // Check if ffmpeg is available
  const ffmpegAvailable = await checkFfmpegAvailable();
  if (!ffmpegAvailable) {
    throw new AppError('FFmpeg is not installed on the server. Reel generation is unavailable.', 503);
  }

  // Start reel generation
  const jobId = await generateReel({
    eventId,
    outputName: `${event.slug}-reel`,
    maxDuration,
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
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
router.get('/reel/:jobId/status', authenticateAdmin, asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { getReelJobStatus } = await import('../services/reelGenerator.js');
  const status = await getReelJobStatus(jobId);

  if (!status) {
    throw new AppError('Job not found', 404);
  }

  res.json({ job: status });
}));

/**
 * GET /api/media/reel/:jobId/download
 * Download/serve a generated reel file (authenticated)
 */
router.get('/reel/:jobId/download', authenticateAdmin, asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get reel job to verify it exists and get the output path
  const reelJob = await prisma.reelJob.findUnique({
    where: { id: jobId },
  });

  if (!reelJob || !reelJob.outputPath) {
    throw new AppError('Reel not found', 404);
  }

  if (reelJob.status !== 'completed') {
    throw new AppError('Reel is not ready', 400);
  }

  // Download file and serve directly
  const { downloadFile, BUCKETS } = await import('../services/supabaseStorage.js');
  
  try {
    const fileBuffer = await downloadFile(BUCKETS.REELS, reelJob.outputPath);
    
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="reel-${jobId}.mp4"`);
    res.setHeader('Content-Length', fileBuffer.length.toString());
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('[Media] Error downloading reel:', error);
    throw new AppError('Failed to download reel', 500);
  }
}));

export default router;
