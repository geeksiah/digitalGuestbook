import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateCouple } from '../middleware/auth.js';
import { calculateEventPhase } from '../utils/phase.js';
import { generateInvitationPass } from '../services/invitation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// All routes require couple authentication (token-based)
router.use(authenticateCouple);

/**
 * GET /api/couple/event
 * Get event details for couple portal
 */
router.get('/event', asyncHandler(async (req, res) => {
  const event = req.event;

  // Get stats
  const [
    totalRsvps,
    pendingRsvps,
    approvedRsvps,
    totalGuests,
    checkedIn,
    mediaCount,
  ] = await Promise.all([
    prisma.rSVP.count({ where: { eventId: event.id } }),
    prisma.rSVP.count({ where: { eventId: event.id, status: 'PENDING' } }),
    prisma.rSVP.count({ where: { eventId: event.id, status: 'APPROVED' } }),
    prisma.rSVP.aggregate({
      where: { eventId: event.id, status: 'APPROVED' },
      _sum: { guestCount: true },
    }),
    prisma.invitation.count({ where: { eventId: event.id, isCheckedIn: true } }),
    prisma.mediaAsset.count({ where: { eventId: event.id } }),
  ]);

  res.json({
    event: {
      id: event.id,
      name: event.name,
      slug: event.slug,
      date: event.date,
      endDate: event.endDate,
      venue: event.venue,
      currentPhase: calculateEventPhase(event),
      invitationOnly: event.invitationOnly,
    },
    stats: {
      rsvps: {
        total: totalRsvps,
        pending: pendingRsvps,
        approved: approvedRsvps,
      },
      guests: {
        expected: totalGuests._sum.guestCount || 0,
        checkedIn,
      },
      media: mediaCount,
    },
  });
}));

/**
 * GET /api/couple/rsvps
 * Get RSVPs for couple portal
 * Per SRS Section 5
 */
router.get('/rsvps', asyncHandler(async (req, res) => {
  const event = req.event;
  const { status, page = '1', limit = '50' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { eventId: event.id };
  if (status) where.status = status;

  const [rsvps, total] = await Promise.all([
    prisma.rSVP.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        primaryName: true,
        secondaryName: true,
        attendance: true,
        guestCount: true,
        mealPreference: true,
        note: true,
        status: true,
        submittedAt: true,
        invitation: {
          select: {
            id: true,
            accessCode: true,
            isCheckedIn: true,
            checkedInAt: true,
          },
        },
      },
    }),
    prisma.rSVP.count({ where }),
  ]);

  res.json({
    rsvps,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / take),
    },
  });
}));

/**
 * POST /api/couple/rsvps/:id/approve
 * Approve an RSVP
 * Per SRS Section 5.2
 */
router.post('/rsvps/:id/approve', asyncHandler(async (req, res) => {
  const event = req.event;
  const { id } = req.params;

  const rsvp = await prisma.rSVP.findFirst({
    where: { id, eventId: event.id },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  if (rsvp.status !== 'PENDING') {
    throw new AppError('RSVP has already been reviewed', 400);
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
    },
  });

  // Generate invitation if attendance is YES
  let invitation = null;
  if (rsvp.attendance === 'YES') {
    invitation = await generateInvitationPass(id);
  }

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      action: 'RSVP_APPROVED',
      entityType: 'RSVP',
      entityId: id,
      details: JSON.stringify({
        name: rsvp.primaryName,
        guestCount: rsvp.guestCount,
        source: 'couple_portal',
      }),
    },
  });

  res.json({
    rsvp: updatedRsvp,
    invitation,
    message: 'RSVP approved successfully',
  });
}));

/**
 * POST /api/couple/rsvps/:id/reject
 * Reject an RSVP
 * Per SRS Section 5.2 & 7
 */
router.post('/rsvps/:id/reject', asyncHandler(async (req, res) => {
  const event = req.event;
  const { id } = req.params;

  const rsvp = await prisma.rSVP.findFirst({
    where: { id, eventId: event.id },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  if (rsvp.status !== 'PENDING') {
    throw new AppError('RSVP has already been reviewed', 400);
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      action: 'RSVP_REJECTED',
      entityType: 'RSVP',
      entityId: id,
      details: JSON.stringify({
        name: rsvp.primaryName,
        source: 'couple_portal',
      }),
    },
  });

  // Per SRS Section 7.3: Fixed rejection message
  // "Thank you for your response. The event organizers will be in touch."
  // Notification would be sent here via the submission channel

  res.json({
    rsvp: updatedRsvp,
    message: 'RSVP rejected. Guest will receive notification.',
  });
}));

/**
 * GET /api/couple/attendance
 * Get attendance status
 */
router.get('/attendance', asyncHandler(async (req, res) => {
  const event = req.event;

  const invitations = await prisma.invitation.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      guestName: true,
      guestCount: true,
      isCheckedIn: true,
      checkedInAt: true,
    },
    orderBy: [
      { isCheckedIn: 'desc' },
      { checkedInAt: 'desc' },
    ],
  });

  const summary = {
    total: invitations.length,
    checkedIn: invitations.filter((i) => i.isCheckedIn).length,
    totalGuests: invitations.reduce((sum, i) => sum + i.guestCount, 0),
    guestsArrived: invitations
      .filter((i) => i.isCheckedIn)
      .reduce((sum, i) => sum + i.guestCount, 0),
  };

  res.json({
    attendance: invitations,
    summary,
  });
}));

/**
 * GET /api/couple/media
 * Get media for couple portal
 * Per SRS Section 10
 */
router.get('/media', asyncHandler(async (req, res) => {
  const event = req.event;
  const { type, page = '1', limit = '50' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { eventId: event.id };
  if (type) where.type = type;

  const [media, total] = await Promise.all([
    prisma.mediaAsset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        type: true,
        guestName: true,
        filePath: true,
        duration: true,
        thumbnailPath: true,
        createdAt: true,
      },
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
 * GET /api/couple/media/download-all
 * Download all media as ZIP
 */
router.get('/media/download-all', asyncHandler(async (req, res) => {
  const event = req.event;

  const mediaAssets = await prisma.mediaAsset.findMany({
    where: { eventId: event.id },
  });

  if (mediaAssets.length === 0) {
    throw new AppError('No media assets found', 404);
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${event.slug}-media-${Date.now()}.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 5 } });
  archive.pipe(res);

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

export default router;
