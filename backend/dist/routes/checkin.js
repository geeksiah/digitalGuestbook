"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const validation_js_1 = require("../utils/validation.js");
const phase_js_1 = require("../utils/phase.js");
const notifications_js_1 = require("../services/notifications.js");
const router = (0, express_1.Router)();
// Notify event owner about check-in
async function notifyOwnerAboutCheckIn(eventId, guestName, guestCount) {
    const event = await prisma_js_1.default.event.findUnique({
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
    if (!event || !event.notifyOnCheckIn)
        return;
    const message = `Guest checked in: ${guestName} (${guestCount} guests) - ${event.name}`;
    if (event.ownerEmail && event.emailNotifications) {
        (0, notifications_js_1.sendEmail)(event.ownerEmail, `Guest Checked In - ${event.name}`, `<div style="font-family: sans-serif;">
        <h2>Guest Checked In</h2>
        <p><strong>Guest:</strong> ${guestName}</p>
        <p><strong>Party Size:</strong> ${guestCount}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>`).catch(err => {
            console.error('[Check-in Notification] Failed to send email:', err);
        });
    }
    if (event.ownerPhone && event.smsNotifications) {
        (0, notifications_js_1.sendSMS)(event.ownerPhone, message).catch(err => {
            console.error('[Check-in Notification] Failed to send SMS:', err);
        });
    }
    if (event.ownerPhone && event.whatsappNotifications) {
        (0, notifications_js_1.sendWhatsApp)(event.ownerPhone, message).catch(err => {
            console.error('[Check-in Notification] Failed to send WhatsApp:', err);
        });
    }
}
/**
 * POST /api/checkin/:eventId
 * Check in a guest
 * Per SRS Section 8
 */
router.post('/:eventId', auth_js_1.optionalAdminAuth, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const data = validation_js_1.checkInSchema.parse(req.body);
    // Find event
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.checkInEnabled) {
        throw new errorHandler_js_1.AppError('Check-in is not enabled for this event', 400);
    }
    // Check-in is only available for invitation-only events
    if (!event.invitationOnly) {
        throw new errorHandler_js_1.AppError('Check-in is only available for invitation-only events', 400);
    }
    // Verify event is in LIVE phase
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    if (!(0, phase_js_1.canCheckIn)(currentPhase)) {
        throw new errorHandler_js_1.AppError('Check-in is only available during the live event', 400);
    }
    // Find invitation by token or access code
    let invitation;
    if (data.token) {
        // QR code scan - parse the token data
        // QR code contains JSON string like: {"type":"event-invitation","eventId":"...","token":"...","code":"..."}
        // OR the frontend might have already parsed it and sent just the token/rsvpId
        try {
            let tokenData = null;
            let parsed = false;
            // Try parsing as JSON string first
            if (typeof data.token === 'string' && data.token.startsWith('{')) {
                try {
                    tokenData = JSON.parse(data.token);
                    parsed = true;
                }
                catch (e) {
                    // Not valid JSON, continue
                }
            }
            if (parsed && tokenData) {
                // QR code was JSON - extract code and token (rsvpId)
                console.log('[Check-in] Parsed QR code JSON:', { code: tokenData.code, token: tokenData.token, eventId: tokenData.eventId });
                invitation = await prisma_js_1.default.invitation.findFirst({
                    where: {
                        eventId,
                        OR: [
                            { accessCode: tokenData.code },
                            { rsvpId: tokenData.token }, // tokenData.token is the rsvpId
                        ],
                    },
                    include: { rsvp: true },
                });
            }
            else {
                // Token is likely already parsed by frontend - could be rsvpId or invitation token UUID
                console.log('[Check-in] Token is not JSON, trying direct lookup:', data.token);
                invitation = await prisma_js_1.default.invitation.findFirst({
                    where: {
                        eventId,
                        OR: [
                            { rsvpId: data.token }, // Direct rsvpId lookup
                            { token: data.token }, // Invitation UUID token lookup
                            { accessCode: data.token }, // Fallback: might be access code
                        ],
                    },
                    include: { rsvp: true },
                });
            }
        }
        catch (parseError) {
            console.error('[Check-in] Error parsing token:', parseError.message);
            // Fallback: try direct lookup
            invitation = await prisma_js_1.default.invitation.findFirst({
                where: {
                    eventId,
                    OR: [
                        { rsvpId: data.token },
                        { token: data.token },
                        { accessCode: data.token },
                    ],
                },
                include: { rsvp: true },
            });
        }
    }
    else if (data.accessCode) {
        // Manual 6-digit code entry
        invitation = await prisma_js_1.default.invitation.findFirst({
            where: { eventId, accessCode: data.accessCode },
            include: { rsvp: true },
        });
    }
    // Log for debugging
    if (invitation) {
        console.log('[Check-in] Found invitation:', {
            id: invitation.id,
            rsvpId: invitation.rsvpId,
            accessCode: invitation.accessCode,
            isCheckedIn: invitation.isCheckedIn,
            rsvpStatus: invitation.rsvp?.status
        });
    }
    else {
        console.log('[Check-in] No invitation found for:', { eventId, token: data.token, accessCode: data.accessCode });
    }
    // Validation per SRS Section 8.2
    let success = false;
    let failureReason = null;
    if (!invitation) {
        failureReason = 'INVALID';
    }
    else if (invitation.rsvp.status !== 'APPROVED') {
        failureReason = 'NOT_APPROVED';
    }
    else if (invitation.isCheckedIn) {
        failureReason = 'ALREADY_USED';
    }
    else {
        success = true;
    }
    // Create check-in record
    const checkIn = await prisma_js_1.default.checkIn.create({
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
        await prisma_js_1.default.invitation.update({
            where: { id: invitation.id },
            data: {
                isCheckedIn: true,
                checkedInAt: new Date(),
            },
        });
        // Audit log
        await prisma_js_1.default.auditLog.create({
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
        const messages = {
            INVALID: 'Invalid code. Please check and try again.',
            NOT_APPROVED: 'This invitation has not been approved.',
            ALREADY_USED: 'This invitation has already been used.',
        };
        return res.status(400).json({
            success: false,
            error: messages[failureReason] || 'Check-in failed',
            failureReason,
        });
    }
    res.json({
        success: true,
        message: 'Check-in successful!',
        guest: {
            name: invitation.guestName,
            guestCount: invitation.guestCount,
            checkedInAt: new Date(),
        },
    });
}));
/**
 * GET /api/checkin/:eventId/stats
 * Get check-in statistics for an event
 */
router.get('/:eventId/stats', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const [totalInvitations, checkedIn, totalExpectedGuests, checkedInGuests, recentCheckIns,] = await Promise.all([
        prisma_js_1.default.invitation.count({ where: { eventId } }),
        prisma_js_1.default.invitation.count({ where: { eventId, isCheckedIn: true } }),
        prisma_js_1.default.invitation.aggregate({
            where: { eventId },
            _sum: { guestCount: true },
        }),
        prisma_js_1.default.invitation.aggregate({
            where: { eventId, isCheckedIn: true },
            _sum: { guestCount: true },
        }),
        prisma_js_1.default.checkIn.findMany({
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
    const failedAttempts = await prisma_js_1.default.checkIn.groupBy({
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
            }, {}),
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
router.get('/:eventId/list', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { success } = req.query;
    const where = { eventId };
    if (success === 'true')
        where.success = true;
    if (success === 'false')
        where.success = false;
    const checkIns = await prisma_js_1.default.checkIn.findMany({
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
exports.default = router;
//# sourceMappingURL=checkin.js.map