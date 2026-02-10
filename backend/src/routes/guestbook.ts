import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { mediaUploadSchema } from '../utils/validation.js';
import { calculateEventPhase, canAccessGuestbook } from '../utils/phase.js';
import { uploadToSupabase, BUCKETS, getPublicUrl } from '../services/supabaseStorage.js';
import { generateVideoThumbnailFromBuffer } from '../services/thumbnailGenerator.js';

const router = Router();

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // LENIENT FILTER: Allow anything that looks like valid media
    // This solves the issue of mobile devices sending complex MIME types (e.g. video/mp4; codecs=...)
    const mimeType = file.mimetype.split(';')[0].trim().toLowerCase();
    
    if (
      mimeType.startsWith('video/') || 
      mimeType.startsWith('audio/') || 
      mimeType.startsWith('image/')
    ) {
      cb(null, true);
    } else {
      console.warn(`[Guestbook] Rejected file type: ${file.mimetype}`);
      cb(new Error(`Invalid file type: ${file.mimetype}`));
    }
  },
});

/**
 * Middleware to verify guestbook access
 */
const createGuestbookAccessMiddleware = (requireAccessCode: boolean = true) => asyncHandler(async (req, res, next) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: req.params.eventId },
        { slug: req.params.eventId },
      ],
    },
    include: !requireAccessCode ? {
      boothTemplate: true,
      boothVideoTemplate: true,
      boothAudioTemplate: true,
      boothPhotoTemplate: true,
    } : undefined,
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.guestbookEnabled) {
    throw new AppError('Guestbook is not enabled for this event', 400);
  }

  const currentPhase = calculateEventPhase(event);
  if (!canAccessGuestbook(currentPhase)) {
    throw new AppError('Guestbook is only available during the live event', 400);
  }

  if (event.invitationOnly && requireAccessCode) {
    const { accessCode } = req.query;
    
    if (!accessCode) {
      throw new AppError('Access code required for this event', 401);
    }

    const invitation = await prisma.invitation.findFirst({
      where: {
        eventId: event.id,
        accessCode: accessCode as string,
      },
      include: { rsvp: true },
    });

    if (!invitation || invitation.rsvp.status !== 'APPROVED') {
      throw new AppError('Invalid or unauthorized access code', 401);
    }

    (req as any).invitation = invitation;
  }

  (req as any).event = event;
  next();
});

const verifyGuestbookAccess = createGuestbookAccessMiddleware(true);
const verifyBoothAccess = createGuestbookAccessMiddleware(false);

/**
 * GET /api/guestbook/:eventId/config
 */
router.get('/:eventId/config', verifyGuestbookAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;

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
 */
router.post(
  '/:eventId/upload',
  verifyGuestbookAccess,
  upload.single('media'),
  asyncHandler(async (req, res) => {
    const event = (req as any).event;
    const file = req.file;

    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const metadata = mediaUploadSchema.parse({
      type: req.body.type,
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
      captureMode: req.body.captureMode,
      deviceId: req.body.deviceId,
      duration: req.body.duration ? parseInt(req.body.duration) : undefined,
    });

    if (metadata.type === 'PHOTO' && metadata.captureMode === 'PERSONAL' && metadata.deviceId) {
      const uploadedPhotos = await prisma.mediaAsset.count({
        where: {
          eventId: event.id,
          type: 'PHOTO',
          deviceId: metadata.deviceId,
        },
      });

      if (uploadedPhotos >= event.maxPhotosPerGuest) {
        throw new AppError(`Maximum ${event.maxPhotosPerGuest} photos allowed per device`, 400);
      }
    }

    // Generate unique filename with Guest Name logic
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.bin';
    
    let safeGuestName = 'guest';
    if (metadata.guestName && metadata.guestName.trim().length > 0) {
        safeGuestName = metadata.guestName.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }
    
    const fileName = `${safeGuestName}-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;

    try {
      const { path: storedPath } = await uploadToSupabase(
        BUCKETS.MEDIA,
        storagePath,
        file.buffer,
        {
          contentType: file.mimetype,
          metadata: {
            eventId: event.id,
            type: metadata.type,
            guestName: metadata.guestName || 'Anonymous',
            originalName: file.originalname,
          },
        }
      );

      let thumbnailPath: string | null = null;
      if (metadata.type === 'VIDEO') {
        try {
          const thumbnailFileName = `thumb-${safeGuestName}-${Date.now()}.jpg`;
          const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
          
          thumbnailPath = await generateVideoThumbnailFromBuffer(
            file.buffer,
            thumbnailStoragePath,
            1 
          );
        } catch (thumbError: any) {
          console.error('[Guestbook] Failed to generate video thumbnail:', thumbError.message);
        }
      }

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          eventId: event.id,
          type: metadata.type,
          guestName: metadata.guestName || 'Anonymous',
          guestEmail: metadata.guestEmail,
          fileName: fileName,
          filePath: storedPath,
          fileSize: file.size,
          mimeType: file.mimetype,
          duration: metadata.duration,
          captureMode: metadata.captureMode || 'PERSONAL',
          deviceId: metadata.deviceId,
          thumbnailPath: thumbnailPath,
          status: 'READY',
        },
      });

      await prisma.auditLog.create({
        data: {
          eventId: event.id,
          action: 'GUESTBOOK_UPLOAD',
          entityType: 'MEDIA',
          entityId: mediaAsset.id,
          details: JSON.stringify({
            type: metadata.type,
            guestName: metadata.guestName || 'Anonymous',
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
    } catch (error: any) {
      console.error('[Guestbook Upload] Supabase upload error:', error);
      throw new AppError(`Failed to upload file: ${error.message}`, 500);
    }
  })
);

router.get('/:eventId/quota', verifyGuestbookAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;
  const { deviceId } = req.query;

  if (!deviceId) {
    return res.json({
      quota: {
        photosRemaining: event.maxPhotosPerGuest,
        maxPhotos: event.maxPhotosPerGuest,
      },
    });
  }

  const uploadedPhotos = await prisma.mediaAsset.count({
    where: {
      eventId: event.id,
      type: 'PHOTO',
      deviceId: deviceId as string,
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

router.get('/:eventId/booth', verifyBoothAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;

  const formatTemplate = (template: any) => template ? {
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
      maxPhotosPerSession: event.maxPhotosPerBoothSession || 10,
      shutterCountdown: event.boothShutterCountdown || 3,
      primaryColor: event.primaryColor || '#6366f1',
      secondaryColor: event.secondaryColor || '#e0e7ff',
      template: formatTemplate(event.boothTemplate),
      videoTemplate: formatTemplate(event.boothVideoTemplate),
      audioTemplate: formatTemplate(event.boothAudioTemplate),
      photoTemplate: formatTemplate(event.boothPhotoTemplate),
    },
  });
}));

router.post(
  '/:eventId/booth/upload',
  verifyBoothAccess,
  upload.single('media'),
  asyncHandler(async (req, res) => {
    const event = (req as any).event;
    const file = req.file;

    if (!file) {
      throw new AppError('No media file provided', 400);
    }

    const metadata = mediaUploadSchema.parse({
      type: req.body.type,
      guestName: req.body.guestName,
      guestEmail: req.body.guestEmail,
      captureMode: 'BOOTH',
      deviceId: req.body.deviceId,
      duration: req.body.duration ? parseInt(req.body.duration) : undefined,
    });

    if (metadata.type === 'PHOTO' && metadata.deviceId) {
      const sessionWindow = 30 * 60 * 1000;
      const sessionStart = new Date(Date.now() - sessionWindow);
      
      const photosInSession = await prisma.mediaAsset.count({
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
        throw new AppError(
          `Maximum ${maxPhotosPerSession} photos per session. Please start a new session.`,
          400
        );
      }
    }

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || '.bin';
    
    let safeGuestName = 'booth-guest';
    if (metadata.guestName && metadata.guestName.trim().length > 0) {
        safeGuestName = metadata.guestName.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    }
    
    const fileName = `${safeGuestName}-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;

    try {
      const { path: storedPath } = await uploadToSupabase(
        BUCKETS.MEDIA,
        storagePath,
        file.buffer,
        {
          contentType: file.mimetype,
          metadata: {
            eventId: event.id,
            type: metadata.type,
            guestName: metadata.guestName || 'Booth Guest',
            originalName: file.originalname,
            captureMode: 'BOOTH',
          },
        }
      );

      let thumbnailPath: string | null = null;
      if (metadata.type === 'VIDEO') {
        try {
          const thumbnailFileName = `thumb-${safeGuestName}-${Date.now()}.jpg`;
          const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
          
          thumbnailPath = await generateVideoThumbnailFromBuffer(
            file.buffer,
            thumbnailStoragePath,
            1
          );
        } catch (thumbError: any) {
          console.error('[Booth] Failed to generate video thumbnail:', thumbError.message);
        }
      }

      const mediaAsset = await prisma.mediaAsset.create({
        data: {
          eventId: event.id,
          type: metadata.type,
          guestName: metadata.guestName || 'Booth Guest',
          guestEmail: metadata.guestEmail,
          fileName: fileName,
          filePath: storedPath,
          fileSize: file.size,
          mimeType: file.mimetype,
          duration: metadata.duration,
          captureMode: 'BOOTH',
          deviceId: metadata.deviceId,
          thumbnailPath: thumbnailPath,
          status: 'READY',
        },
      });

      await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('[Booth Upload] Supabase upload error:', error);
      throw new AppError(`Failed to upload file: ${error.message}`, 500);
    }
  })
);

router.post('/:eventId/booth/session-qr', verifyBoothAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;
  const { deviceId, sessionStart } = req.body;

  if (!deviceId || !sessionStart) {
    throw new AppError('deviceId and sessionStart are required', 400);
  }

  const sessionStartDate = new Date(sessionStart);
  if (isNaN(sessionStartDate.getTime())) {
    throw new AppError('Invalid sessionStart date', 400);
  }

  const { generateBoothSessionDownloadQR } = await import('../services/boothDownload.js');
  const qrCodeData = await generateBoothSessionDownloadQR(event.id, deviceId, sessionStartDate);

  res.json({ qrCodeData });
}));

export default router;