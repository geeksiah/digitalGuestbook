import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin, optionalAdminAuth } from '../middleware/auth.js';
import { checkInSchema } from '../utils/validation.js';
import { calculateEventPhase, canCheckIn } from '../utils/phase.js';
import { sendEmail, sendSMS, sendWhatsApp } from '../services/notifications.js';

const router = Router();

// Notify event owner about check-in
async function notifyOwnerAboutCheckIn(eventId: string, guestName: string, guestCount: number) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      name: true,
      ownerEmail: true,
      ownerPhone: true,
      notifyOnCheckIn: true,
      emailNotifications: true,
      smsNotifications: true,
      whatsappNotifications: true,
    },
  });

  if (!event || !event.notifyOnCheckIn) return;

  const message = `Guest checked in: ${guestName} (${guestCount} guests) - ${event.name}`;

  if (event.ownerEmail && event.emailNotifications) {
    sendEmail(
      event.ownerEmail,
      `Guest Checked In - ${event.name}`,
      `<div style="font-family: sans-serif;">
        <h2>Guest Checked In</h2>
        <p><strong>Guest:</strong> ${guestName}</p>
        <p><strong>Party Size:</strong> ${guestCount}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>`
    ).catch(err => {
      console.error('[Check-in Notification] Failed to send email:', err);
    });
  }

  if (event.ownerPhone && event.smsNotifications) {
    sendSMS(event.ownerPhone, message).catch(err => {
      console.error('[Check-in Notification] Failed to send SMS:', err);
    });
  }

  if (event.ownerPhone && event.whatsappNotifications) {
    sendWhatsApp(event.ownerPhone, message).catch(err => {
      console.error('[Check-in Notification] Failed to send WhatsApp:', err);
    });
  }
}

/**
 * POST /api/checkin/:eventId
 * Check in a guest
 * Per SRS Section 8
 */
router.post('/:eventId', optionalAdminAuth, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const data = checkInSchema.parse(req.body);

  // Find event
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (!event.checkInEnabled) {
    throw new AppError('Check-in is not enabled for this event', 400);
  }

  // Verify event is in LIVE phase
  const currentPhase = calculateEventPhase(event);
  if (!canCheckIn(currentPhase)) {
    throw new AppError('Check-in is only available during the live event', 400);
  }

  // Find invitation by token or access code
  let invitation;
  
  if (data.token) {
    // QR code scan - parse the token data
    try {
      const tokenData = JSON.parse(data.token);
      invitation = await prisma.invitation.findFirst({
        where: {
          eventId,
          OR: [
            { token: tokenData.token },
            { accessCode: tokenData.code },
          ],
        },
        include: { rsvp: true },
      });
    } catch {
      // Token might be a direct token string
      invitation = await prisma.invitation.findFirst({
        where: { eventId, token: data.token },
        include: { rsvp: true },
      });
    }
  } else if (data.accessCode) {
    // Manual 6-digit code entry
    invitation = await prisma.invitation.findFirst({
      where: { eventId, accessCode: data.accessCode },
      include: { rsvp: true },
    });
  }

  // Validation per SRS Section 8.2
  let success = false;
  let failureReason: string | null = null;

  if (!invitation) {
    failureReason = 'INVALID';
  } else if (invitation.rsvp.status !== 'APPROVED') {
    failureReason = 'NOT_APPROVED';
  } else if (invitation.isCheckedIn) {
    failureReason = 'ALREADY_USED';
  } else {
    success = true;
  }

  // Create check-in record
  const checkIn = await prisma.checkIn.create({
    data: {
      eventId,
      invitationId: invitation?.id || 'unknown',
      method: data.method,
      success,
      failureReason,
      deviceInfo: data.deviceInfo,
      ipAddress: req.ip,
    },
  });

  // If successful, mark invitation as checked in
  if (success && invitation) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: {
        isCheckedIn: true,
        checkedInAt: new Date(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        eventId,
        adminId: req.admin?.id,
        action: 'GUEST_CHECKED_IN',
        entityType: 'INVITATION',
        entityId: invitation.id,
        details: JSON.stringify({
          guestName: invitation.guestName,
          guestCount: invitation.guestCount,
          method: data.method,
        }),
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    });

    // Notify event owner (async - don't wait)
    notifyOwnerAboutCheckIn(eventId, invitation.guestName, invitation.guestCount)
      .catch(err => console.error('[Notification] Failed to notify owner about check-in:', err));
  }

  // Response
  if (!success) {
    const messages: Record<string, string> = {
      INVALID: 'Invalid code. Please check and try again.',
      NOT_APPROVED: 'This invitation has not been approved.',
      ALREADY_USED: 'This invitation has already been used.',
    };

    return res.status(400).json({
      success: false,
      error: messages[failureReason!] || 'Check-in failed',
      failureReason,
    });
  }

  res.json({
    success: true,
    message: 'Check-in successful!',
    guest: {
      name: invitation!.guestName,
      guestCount: invitation!.guestCount,
      checkedInAt: new Date(),
    },
  });
}));

/**
 * GET /api/checkin/:eventId/stats
 * Get check-in statistics for an event
 */
router.get('/:eventId/stats', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const [
    totalInvitations,
    checkedIn,
    totalExpectedGuests,
    checkedInGuests,
    recentCheckIns,
  ] = await Promise.all([
    prisma.invitation.count({ where: { eventId } }),
    prisma.invitation.count({ where: { eventId, isCheckedIn: true } }),
    prisma.invitation.aggregate({
      where: { eventId },
      _sum: { guestCount: true },
    }),
    prisma.invitation.aggregate({
      where: { eventId, isCheckedIn: true },
      _sum: { guestCount: true },
    }),
    prisma.checkIn.findMany({
      where: { eventId, success: true },
      orderBy: { checkedInAt: 'desc' },
      take: 10,
      include: {
        invitation: {
          select: { guestName: true, guestCount: true },
        },
      },
    }),
  ]);

  // Failed check-in attempts
  const failedAttempts = await prisma.checkIn.groupBy({
    by: ['failureReason'],
    where: { eventId, success: false },
    _count: true,
  });

  res.json({
    stats: {
      invitations: {
        total: totalInvitations,
        checkedIn,
        remaining: totalInvitations - checkedIn,
      },
      guests: {
        expected: totalExpectedGuests._sum.guestCount || 0,
        arrived: checkedInGuests._sum.guestCount || 0,
      },
      failedAttempts: failedAttempts.reduce((acc, item) => {
        if (item.failureReason) {
          acc[item.failureReason] = item._count;
        }
        return acc;
      }, {} as Record<string, number>),
    },
    recentCheckIns: recentCheckIns.map((c) => ({
      guestName: c.invitation.guestName,
      guestCount: c.invitation.guestCount,
      checkedInAt: c.checkedInAt,
    })),
  });
}));

/**
 * GET /api/checkin/:eventId/list
 * Get list of all check-ins for an event
 */
router.get('/:eventId/list', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { success } = req.query;

  const where: any = { eventId };
  if (success === 'true') where.success = true;
  if (success === 'false') where.success = false;

  const checkIns = await prisma.checkIn.findMany({
    where,
    orderBy: { checkedInAt: 'desc' },
    include: {
      invitation: {
        select: {
          guestName: true,
          guestCount: true,
          accessCode: true,
        },
      },
    },
  });

  res.json({ checkIns });
}));

export default router;
