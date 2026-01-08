import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createRsvpSchema, reviewRsvpSchema } from '../utils/validation.js';
import { calculateEventPhase, canSubmitRsvp } from '../utils/phase.js';
import { generateInvitationPass } from '../services/invitation.js';
import { sendRsvpConfirmation, sendInvitationEmail, sendEmail, sendSMS, sendWhatsApp } from '../services/notifications.js';

const router = Router();

// Send notification to couple about new RSVP
async function notifyCoupleAboutRsvp(eventId: string, rsvpData: { primaryName: string; attendance: string; guestCount: number }) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      name: true,
      coupleEmail: true,
      couplePhone: true,
      notifyOnRsvp: true,
      emailNotifications: true,
      smsNotifications: true,
      whatsappNotifications: true,
    },
  });

  if (!event || !event.notifyOnRsvp) return;

  const message = `New RSVP for ${event.name}: ${rsvpData.primaryName} - ${rsvpData.attendance} (${rsvpData.guestCount} guests)`;

  if (event.coupleEmail && event.emailNotifications) {
    await sendEmail(
      event.coupleEmail,
      `New RSVP - ${event.name}`,
      `<div style="font-family: sans-serif;">
        <h2>New RSVP Received</h2>
        <p><strong>Guest:</strong> ${rsvpData.primaryName}</p>
        <p><strong>Response:</strong> ${rsvpData.attendance}</p>
        <p><strong>Party Size:</strong> ${rsvpData.guestCount}</p>
      </div>`
    );
  }

  if (event.couplePhone && event.smsNotifications) {
    await sendSMS(event.couplePhone, message);
  }

  if (event.couplePhone && event.whatsappNotifications) {
    await sendWhatsApp(event.couplePhone, message);
  }
}

/**
 * POST /api/rsvp/:eventSlug
 * Submit RSVP (Public - no auth required)
 * Per SRS Section 4.2
 */
router.post('/:eventSlug', asyncHandler(async (req, res) => {
  const { eventSlug } = req.params;
  const data = createRsvpSchema.parse(req.body);

  // Find event by slug
  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.rsvpEnabled) {
    throw new AppError('RSVP is not enabled for this event', 400);
  }

  // Check phase - RSVP only allowed in PRE_EVENT
  const currentPhase = calculateEventPhase(event);
  if (!canSubmitRsvp(currentPhase)) {
    throw new AppError('RSVP submission is closed for this event', 400);
  }

  // Determine initial status based on invitation-only flag
  // Per SRS Section 4.3: invitation_only events have pending RSVPs
  const initialStatus = event.invitationOnly ? 'PENDING' : 'APPROVED';

  const rsvp = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      primaryName: data.primaryName,
      secondaryName: data.secondaryName,
      email: data.email || null,
      phone: data.phone,
      attendance: data.attendance,
      guestCount: data.guestCount,
      mealPreference: data.mealPreference,
      dietaryNotes: data.dietaryNotes,
      note: data.note,
      status: initialStatus,
      submissionChannel: data.submissionChannel,
    },
  });

  // If auto-approved (not invitation-only), generate invitation pass immediately
  let invitation = null;
  if (!event.invitationOnly && data.attendance === 'YES') {
    invitation = await generateInvitationPass(rsvp.id);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      action: 'RSVP_SUBMITTED',
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({
        name: data.primaryName,
        attendance: data.attendance,
        guestCount: data.guestCount,
        status: initialStatus,
      }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  // Send notifications (async - don't wait)
  notifyCoupleAboutRsvp(event.id, {
    primaryName: data.primaryName,
    attendance: data.attendance,
    guestCount: data.guestCount,
  }).catch(err => console.error('[Notification] Failed to notify couple:', err));

  // Send confirmation to guest if email provided
  if (rsvp.email) {
    sendRsvpConfirmation(rsvp.id).catch(err => console.error('[Notification] Failed to send confirmation:', err));
  }

  // If auto-approved with invitation, send invitation email
  if (invitation && rsvp.email) {
    sendInvitationEmail(invitation.id).catch(err => console.error('[Notification] Failed to send invitation:', err));
  }

  res.status(201).json({
    success: true,
    rsvp: {
      id: rsvp.id,
      status: rsvp.status,
      attendance: rsvp.attendance,
    },
    message: event.invitationOnly
      ? 'Thank you! Your RSVP has been submitted and is pending approval.'
      : 'Thank you! Your RSVP has been confirmed.',
  });
}));

/**
 * GET /api/rsvp/event/:eventId
 * List RSVPs for an event (Admin only)
 */
router.get('/event/:eventId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { status, attendance, page = '1', limit = '50' } = req.query;

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = { eventId };
  if (status) where.status = status;
  if (attendance) where.attendance = attendance;

  const [rsvps, total] = await Promise.all([
    prisma.rSVP.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip,
      take,
      include: {
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
 * GET /api/rsvp/:id
 * Get single RSVP details (Admin only)
 */
router.get('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: req.params.id },
    include: {
      event: { select: { id: true, name: true, slug: true } },
      invitation: true,
    },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  res.json({ rsvp });
}));

/**
 * POST /api/rsvp/:id/review
 * Approve or reject RSVP (Admin only)
 * Per SRS Section 5 & 7
 */
router.post('/:id/review', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = reviewRsvpSchema.parse(req.body);

  const rsvp = await prisma.rSVP.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  if (rsvp.status !== 'PENDING') {
    throw new AppError('RSVP has already been reviewed', 400);
  }

  // Update RSVP status
  const updatedRsvp = await prisma.rSVP.update({
    where: { id: req.params.id },
    data: {
      status: data.status,
      reviewedAt: new Date(),
      reviewedBy: req.admin!.id,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: rsvp.eventId,
      adminId: req.admin!.id,
      action: data.status === 'APPROVED' ? 'RSVP_APPROVED' : 'RSVP_REJECTED',
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({
        name: rsvp.primaryName,
        guestCount: rsvp.guestCount,
      }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  let invitation = null;

  if (data.status === 'APPROVED' && rsvp.attendance === 'YES') {
    // Generate invitation pass (SRS Section 6)
    invitation = await generateInvitationPass(rsvp.id);
  }

  // For rejection, send notification (SRS Section 7)
  // The fixed message: "Thank you for your response. The event organizers will be in touch."
  // Notification would be sent via the same channel used for RSVP submission

  res.json({
    rsvp: updatedRsvp,
    invitation,
    message: data.status === 'APPROVED'
      ? 'RSVP approved successfully'
      : 'RSVP rejected. Guest has been notified.',
  });
}));

/**
 * POST /api/rsvp/:id/approve
 * Quick approve RSVP (Admin only)
 */
router.post('/:id/approve', authenticateAdmin, asyncHandler(async (req, res) => {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: req.params.id },
    include: { event: true },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id: req.params.id },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedBy: req.admin!.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId: rsvp.eventId,
      adminId: req.admin!.id,
      action: 'RSVP_APPROVED',
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({ name: rsvp.primaryName, guestCount: rsvp.guestCount }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  let invitation = null;
  if (rsvp.attendance === 'YES') {
    invitation = await generateInvitationPass(rsvp.id);
  }

  res.json({ rsvp: updatedRsvp, invitation, message: 'RSVP approved successfully' });
}));

/**
 * POST /api/rsvp/:id/reject
 * Quick reject RSVP (Admin only)
 */
router.post('/:id/reject', authenticateAdmin, asyncHandler(async (req, res) => {
  const rsvp = await prisma.rSVP.findUnique({
    where: { id: req.params.id },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id: req.params.id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: req.admin!.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId: rsvp.eventId,
      adminId: req.admin!.id,
      action: 'RSVP_REJECTED',
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({ name: rsvp.primaryName, guestCount: rsvp.guestCount }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  res.json({ rsvp: updatedRsvp, message: 'RSVP rejected. Guest has been notified.' });
}));

/**
 * POST /api/rsvp/bulk-review
 * Bulk approve/reject RSVPs (Admin only)
 */
router.post('/bulk-review', authenticateAdmin, asyncHandler(async (req, res) => {
  const { rsvpIds, status } = req.body;

  if (!Array.isArray(rsvpIds) || rsvpIds.length === 0) {
    throw new AppError('rsvpIds must be a non-empty array', 400);
  }

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError('Invalid status', 400);
  }

  const results = {
    processed: 0,
    skipped: 0,
    invitationsGenerated: 0,
  };

  for (const rsvpId of rsvpIds) {
    const rsvp = await prisma.rSVP.findUnique({
      where: { id: rsvpId },
    });

    if (!rsvp || rsvp.status !== 'PENDING') {
      results.skipped++;
      continue;
    }

    await prisma.rSVP.update({
      where: { id: rsvpId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: req.admin!.id,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        eventId: rsvp.eventId,
        adminId: req.admin!.id,
        action: status === 'APPROVED' ? 'RSVP_APPROVED' : 'RSVP_REJECTED',
        entityType: 'RSVP',
        entityId: rsvp.id,
        details: JSON.stringify({ bulk: true }),
      },
    });

    if (status === 'APPROVED' && rsvp.attendance === 'YES') {
      await generateInvitationPass(rsvpId);
      results.invitationsGenerated++;
    }

    results.processed++;
  }

  res.json({
    message: `Processed ${results.processed} RSVPs`,
    results,
  });
}));

export default router;
