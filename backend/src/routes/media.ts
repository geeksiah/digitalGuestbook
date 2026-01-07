import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin, authenticateCouple } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const where: any = { eventId };
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

  res.json({
    media,
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
 */
router.get('/:id/download', asyncHandler(async (req, res) => {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: req.params.id },
  });

  if (!mediaAsset) {
    throw new AppError('Media asset not found', 404);
  }

  const filePath = path.join(__dirname, '../..', mediaAsset.filePath);
  
  if (!fs.existsSync(filePath)) {
    throw new AppError('File not found', 404);
  }

  res.download(filePath, mediaAsset.fileName);
}));

/**
 * GET /api/media/event/:eventId/download-all
 * Download all media as ZIP
 * Per SRS Section 10
 */
router.get('/event/:eventId/download-all', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: { eventId },
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
    const filePath = path.join(__dirname, '../..', asset.filePath);
    
    if (fs.existsSync(filePath)) {
      const folder = asset.type.toLowerCase();
      const fileName = asset.guestName
        ? `${asset.guestName}-${asset.fileName}`
        : asset.fileName;
      
      archive.file(filePath, { name: `${folder}/${fileName}` });
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

  // Delete file from disk
  const filePath = path.join(__dirname, '../..', mediaAsset.filePath);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Delete thumbnail if exists
  if (mediaAsset.thumbnailPath) {
    const thumbPath = path.join(__dirname, '../..', mediaAsset.thumbnailPath);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
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

export default router;
