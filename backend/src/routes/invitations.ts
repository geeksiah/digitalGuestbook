import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { generateInvitationPass, getInvitationPDF } from '../services/invitation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

/**
 * GET /api/invitations/event/:eventId
 * List all invitations for an event (Admin only)
 */
router.get('/event/:eventId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { checkedIn } = req.query;

  const where: any = { eventId };
  if (checkedIn === 'true') where.isCheckedIn = true;
  if (checkedIn === 'false') where.isCheckedIn = false;

  const invitations = await prisma.invitation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      rsvp: {
        select: {
          primaryName: true,
          secondaryName: true,
          email: true,
          phone: true,
          guestCount: true,
        },
      },
    },
  });

  res.json({ invitations });
}));

/**
 * GET /api/invitations/:id
 * Get single invitation details
 */
router.get('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.id },
    include: {
      event: true,
      rsvp: true,
      checkIns: {
        orderBy: { checkedInAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  res.json({ invitation });
}));

/**
 * GET /api/invitations/:id/pdf
 * Download invitation PDF
 */
router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const invitation = await prisma.invitation.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });

  if (!invitation) {
    throw new AppError('Invitation not found', 404);
  }

  const pdfPath = await getInvitationPDF(invitation.id);

  res.download(pdfPath, `invitation-${invitation.event.slug}-${invitation.accessCode}.pdf`);
}));

/**
 * GET /api/invitations/by-code/:accessCode
 * Lookup invitation by access code (for check-in)
 */
router.get('/by-code/:accessCode', asyncHandler(async (req, res) => {
  const invitation = await prisma.invitation.findUnique({
    where: { accessCode: req.params.accessCode },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          date: true,
          venue: true,
        },
      },
      rsvp: {
        select: {
          primaryName: true,
          secondaryName: true,
          guestCount: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new AppError('Invalid access code', 404);
  }

  res.json({
    invitation: {
      id: invitation.id,
      guestName: invitation.guestName,
      guestCount: invitation.guestCount,
      isCheckedIn: invitation.isCheckedIn,
      checkedInAt: invitation.checkedInAt,
      event: invitation.event,
    },
  });
}));

/**
 * GET /api/invitations/by-token/:token
 * Lookup invitation by token (for QR code scanning)
 */
router.get('/by-token/:token', asyncHandler(async (req, res) => {
  const invitation = await prisma.invitation.findUnique({
    where: { token: req.params.token },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          date: true,
          venue: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new AppError('Invalid invitation token', 404);
  }

  res.json({
    invitation: {
      id: invitation.id,
      guestName: invitation.guestName,
      guestCount: invitation.guestCount,
      isCheckedIn: invitation.isCheckedIn,
      checkedInAt: invitation.checkedInAt,
      event: invitation.event,
    },
  });
}));

/**
 * POST /api/invitations/regenerate/:rsvpId
 * Regenerate invitation for an RSVP (Admin only)
 */
router.post('/regenerate/:rsvpId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { rsvpId } = req.params;

  const rsvp = await prisma.rSVP.findUnique({
    where: { id: rsvpId },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  if (rsvp.status !== 'APPROVED') {
    throw new AppError('RSVP must be approved to generate invitation', 400);
  }

  // Delete existing invitation if any
  await prisma.invitation.deleteMany({
    where: { rsvpId },
  });

  // Generate new invitation
  const invitation = await generateInvitationPass(rsvpId);

  res.json({ invitation });
}));

export default router;
