import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { mediaUploadSchema } from '../utils/validation.js';
import { calculateEventPhase, canAccessGuestbook } from '../utils/phase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Configure multer for media uploads
const uploadsDir = path.join(__dirname, '../../uploads/media');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const eventDir = path.join(uploadsDir, req.params.eventId || 'unknown');
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }
    cb(null, eventDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

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
 */
const verifyGuestbookAccess = asyncHandler(async (req, res, next) => {
  const event = await prisma.event.findFirst({
    where: {
      OR: [
        { id: req.params.eventId },
        { slug: req.params.eventId },
      ],
    },
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

  // For invitation-only events, verify guest has valid invitation
  if (event.invitationOnly) {
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

    // Check photo upload limits per SRS
    if (metadata.type === 'PHOTO' && metadata.deviceId) {
      const existingPhotos = await prisma.mediaAsset.count({
        where: {
          eventId: event.id,
          type: 'PHOTO',
          deviceId: metadata.deviceId,
        },
      });

      if (existingPhotos >= event.maxPhotosPerGuest) {
        // Delete the uploaded file
        fs.unlinkSync(file.path);
        throw new AppError(
          `Photo upload limit reached (${event.maxPhotosPerGuest} photos)`,
          400
        );
      }
    }

    // Validate recording duration
    if (metadata.type === 'VIDEO' || metadata.type === 'AUDIO') {
      if (metadata.duration) {
        if (metadata.duration < event.minRecordingDuration) {
          fs.unlinkSync(file.path);
          throw new AppError(
            `Recording too short (minimum ${event.minRecordingDuration} seconds)`,
            400
          );
        }
        if (metadata.duration > event.maxRecordingDuration) {
          fs.unlinkSync(file.path);
          throw new AppError(
            `Recording too long (maximum ${event.maxRecordingDuration} seconds)`,
            400
          );
        }
      }
    }

    // Create media asset record
    const mediaAsset = await prisma.mediaAsset.create({
      data: {
        eventId: event.id,
        type: metadata.type,
        guestName: metadata.guestName,
        guestEmail: metadata.guestEmail || null,
        fileName: file.filename,
        filePath: `/uploads/media/${event.id}/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
        duration: metadata.duration,
        captureMode: metadata.captureMode,
        deviceId: metadata.deviceId,
        status: 'UPLOADED',
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventId: event.id,
        action: 'MEDIA_UPLOADED',
        entityType: 'MEDIA',
        entityId: mediaAsset.id,
        details: JSON.stringify({
          type: metadata.type,
          guestName: metadata.guestName,
          captureMode: metadata.captureMode,
        }),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Upload successful! Thank you for your message.',
      mediaAsset: {
        id: mediaAsset.id,
        type: mediaAsset.type,
        status: mediaAsset.status,
      },
    });
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
 * Get booth mode configuration
 */
router.get('/:eventId/booth', verifyGuestbookAccess, asyncHandler(async (req, res) => {
  const event = (req as any).event;

  res.json({
    booth: {
      eventId: event.id,
      eventName: event.name,
      maxRecordingDuration: event.maxRecordingDuration,
      minRecordingDuration: event.minRecordingDuration,
      // Booth mode typically allows unlimited photos from the kiosk
      unlimitedPhotos: true,
    },
  });
}));

export default router;
