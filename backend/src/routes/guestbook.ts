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

// Configure multer to use memory storage (we'll upload directly to Supabase)
const storage = multer.memoryStorage();

const upload = multer({
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
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * Middleware to verify guestbook access
 * @param requireAccessCode - Whether to require access code for invitation-only events (default: true)
 */
const createGuestbookAccessMiddleware = (requireAccessCode: boolean = true) => asyncHandler(async (req, res, next) => {
  const event = await prisma.event.findFirst({
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
    throw new AppError('Event not found', 404);
  }

  if (!event.guestbookEnabled) {
    throw new AppError('Guestbook is not enabled for this event', 400);
  }

  // Verify event is in LIVE phase per SRS Section 9
  const currentPhase = calculateEventPhase(event);
  if (!canAccessGuestbook(currentPhase)) {
    throw new AppError('Guestbook is only available during the live event', 400);
  }

  // For invitation-only events, verify guest has valid invitation (unless booth mode)
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

    // Attach invitation to request for reference
    (req as any).invitation = invitation;
  }

  (req as any).event = event;
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
 * Upload media (video, audio, or photo)
 * Per SRS Section 9.2
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

    // Check photo limits for PERSONAL mode
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

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `media-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;

    try {
      // Upload to Supabase Storage
      const { path: storedPath, publicUrl } = await uploadToSupabase(
        BUCKETS.MEDIA,
        storagePath,
        file.buffer,
        {
          contentType: file.mimetype,
          metadata: {
            eventId: event.id,
            type: metadata.type,
            guestName: metadata.guestName || '',
            originalName: file.originalname,
          },
        }
      );

      // Generate thumbnail for videos
      let thumbnailPath: string | null = null;
      if (metadata.type === 'VIDEO') {
        try {
          const thumbnailFileName = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
          const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
          
          thumbnailPath = await generateVideoThumbnailFromBuffer(
            file.buffer,
            thumbnailStoragePath,
            1 // Extract frame at 1 second
          );
          
          console.log(`[Guestbook] Generated thumbnail for video: ${thumbnailPath}`);
        } catch (thumbError: any) {
          console.error('[Guestbook] Failed to generate video thumbnail:', thumbError.message);
          // Continue without thumbnail - video will still be uploaded
        }
      }

      // Create media asset record
      const mediaAsset = await prisma.mediaAsset.create({
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
      await prisma.auditLog.create({
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
    } catch (error: any) {
      console.error('[Guestbook Upload] Supabase upload error:', error);
      throw new AppError(`Failed to upload file: ${error.message}`, 500);
    }
  })
);

/**
 * GET /api/guestbook/:eventId/quota
 * Check remaining upload quota for a device
 */
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

/**
 * GET /api/guestbook/:eventId/booth
 * Get booth mode configuration (no access code required - kiosk mode)
 * UPDATED: Now includes maxPhotosPerSession and shutterCountdown from event settings
 */
router.get('/:eventId/booth', verifyBoothAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;

  // Helper to format template data
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
      captureMode: 'BOOTH', // Force booth mode
      deviceId: req.body.deviceId,
      duration: req.body.duration ? parseInt(req.body.duration) : undefined,
    });

    // For photos, check session limit (using deviceId + timestamp window)
    if (metadata.type === 'PHOTO' && metadata.deviceId) {
      const sessionWindow = 30 * 60 * 1000; // 30 minute session window
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
        // With memory storage, no file to delete - just throw error
        throw new AppError(
          `Maximum ${maxPhotosPerSession} photos per session. Please start a new session.`,
          400
        );
      }
    }

    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const fileName = `booth-${uniqueSuffix}${ext}`;
    const storagePath = `${event.id}/${fileName}`;

    try {
      // Upload to Supabase Storage
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

      // Generate thumbnail for videos
      let thumbnailPath: string | null = null;
      if (metadata.type === 'VIDEO') {
        try {
          const thumbnailFileName = `thumb-${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
          const thumbnailStoragePath = `${event.id}/${thumbnailFileName}`;
          
          thumbnailPath = await generateVideoThumbnailFromBuffer(
            file.buffer,
            thumbnailStoragePath,
            1 // Extract frame at 1 second
          );
          
          console.log(`[Booth] Generated thumbnail for video: ${thumbnailPath}`);
        } catch (thumbError: any) {
          console.error('[Booth] Failed to generate video thumbnail:', thumbError.message);
          // Continue without thumbnail - video will still be uploaded
        }
      }

      // Create media asset record
      const mediaAsset = await prisma.mediaAsset.create({
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

export default router;
