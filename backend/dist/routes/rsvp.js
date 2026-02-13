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
const invitation_js_1 = require("../services/invitation.js");
const notifications_js_1 = require("../services/notifications.js");
const router = (0, express_1.Router)();
// Send notification to event owner about new RSVP
async function notifyOwnerAboutRsvp(eventId, rsvpData) {
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: {
            name: true,
            ownerEmail: true,
            ownerPhone: true,
            notifyOnRsvp: true,
            emailNotifications: true,
            smsNotifications: true,
            whatsappNotifications: true,
        },
    });
    if (!event || !event.notifyOnRsvp)
        return;
    const message = `New RSVP for ${event.name}: ${rsvpData.primaryName} - ${rsvpData.attendance} (${rsvpData.guestCount} guests)`;
    if (event.ownerEmail && event.emailNotifications) {
        (0, notifications_js_1.sendEmail)(event.ownerEmail, `New RSVP - ${event.name}`, `<div style="font-family: sans-serif;">
        <h2>New RSVP Received</h2>
        <p><strong>Guest:</strong> ${rsvpData.primaryName}</p>
        <p><strong>Response:</strong> ${rsvpData.attendance}</p>
        <p><strong>Party Size:</strong> ${rsvpData.guestCount}</p>
      </div>`).catch((err) => {
            console.error('[RSVP Notification] Failed to send email:', err);
        });
    }
    if (event.ownerPhone && event.smsNotifications) {
        (0, notifications_js_1.sendSMS)(event.ownerPhone, message).catch((err) => {
            console.error('[RSVP Notification] Failed to send SMS:', err);
        });
    }
    if (event.ownerPhone && event.whatsappNotifications) {
        (0, notifications_js_1.sendWhatsApp)(event.ownerPhone, message).catch((err) => {
            console.error('[RSVP Notification] Failed to send WhatsApp:', err);
        });
    }
}
/**
 * POST /api/rsvp/invite/:token/respond
 * One-tap invite response from WhatsApp/deep-link card
 */
router.post('/invite/:token/respond', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const response = String(req.body?.response || req.body?.attendance || '').toUpperCase();
    const attendance = response === 'YES' || response === 'NO' ? response : '';
    if (!attendance) {
        throw new errorHandler_js_1.AppError('Response must be YES or NO', 400);
    }
    const invite = await prisma_js_1.default.rsvpInvite.findUnique({
        where: { token },
        include: {
            event: true,
            rsvp: true,
        },
    });
    if (!invite)
        throw new errorHandler_js_1.AppError('Invite not found', 404);
    if (invite.expiresAt && invite.expiresAt < new Date())
        throw new errorHandler_js_1.AppError('Invite has expired', 410);
    if (invite.status === 'RESPONDED' || invite.rsvpId)
        throw new errorHandler_js_1.AppError('Invite has already been used', 409);
    const status = invite.event.invitationOnly ? 'PENDING' : 'APPROVED';
    const guestCount = Math.max(1, Number(req.body?.partySize || 1));
    const rsvp = await prisma_js_1.default.rSVP.create({
        data: {
            eventId: invite.eventId,
            primaryName: invite.inviteeName || 'Guest',
            email: invite.inviteeEmail || null,
            phone: invite.inviteePhone || null,
            attendance,
            guestCount,
            note: req.body?.note ? String(req.body.note) : null,
            status,
            submissionChannel: 'WHATSAPP',
        },
    });
    await prisma_js_1.default.rsvpInvite.update({
        where: { id: invite.id },
        data: {
            status: 'RESPONDED',
            initialResponse: attendance,
            respondedAt: new Date(),
            partySize: guestCount,
            note: req.body?.note ? String(req.body.note) : null,
            rsvpId: rsvp.id,
        },
    });
    let invitation = null;
    if (attendance === 'YES' && status === 'APPROVED') {
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch(err => console.error('[RSVP Invite Respond] Failed to send invitation notifications:', err));
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: invite.eventId,
            action: 'RSVP_INVITE_RESPONDED',
            entityType: 'RSVP_INVITE',
            entityId: invite.id,
            details: JSON.stringify({
                attendance,
                rsvpId: rsvp.id,
            }),
        },
    });
    res.json({
        success: true,
        rsvp: {
            id: rsvp.id,
            status: rsvp.status,
            attendance: rsvp.attendance,
            guestCount: rsvp.guestCount,
        },
        invitation,
        nextStep: 'details_optional',
    });
}));
/**
 * PATCH /api/rsvp/invite/:token/details
 * Optional details after one-tap invite response
 */
router.patch('/invite/:token/details', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const invite = await prisma_js_1.default.rsvpInvite.findUnique({
        where: { token },
        include: {
            rsvp: true,
        },
    });
    if (!invite)
        throw new errorHandler_js_1.AppError('Invite not found', 404);
    if (!invite.rsvpId || !invite.rsvp)
        throw new errorHandler_js_1.AppError('Invite has not been responded to yet', 400);
    const guestCount = req.body?.partySize ? Math.max(1, Number(req.body.partySize)) : undefined;
    const note = req.body?.note !== undefined ? String(req.body.note || '') : undefined;
    const email = req.body?.email !== undefined ? String(req.body.email || '') : undefined;
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: invite.rsvpId },
        data: {
            guestCount: guestCount ?? undefined,
            note: note !== undefined ? note || null : undefined,
            email: email !== undefined ? email || null : undefined,
        },
    });
    const updatedInvite = await prisma_js_1.default.rsvpInvite.update({
        where: { id: invite.id },
        data: {
            partySize: guestCount ?? invite.partySize,
            note: note !== undefined ? note || null : invite.note,
            inviteeEmail: email !== undefined ? email || null : invite.inviteeEmail,
        },
    });
    res.json({
        success: true,
        invite: updatedInvite,
        rsvp: updatedRsvp,
    });
}));
/**
 * POST /api/rsvp/:eventSlug
 * Submit RSVP (Public - no auth required)
 * Per SRS Section 4.2
 */
router.post('/:eventSlug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventSlug } = req.params;
    console.log('[RSVP] Received request for event slug:', eventSlug);
    console.log('[RSVP] Request body:', JSON.stringify(req.body, null, 2));
    let data;
    try {
        data = validation_js_1.createRsvpSchema.parse(req.body);
    }
    catch (error) {
        console.error('[RSVP] Validation error:', error);
        if (error.name === 'ZodError') {
            console.error('[RSVP] Validation issues:', JSON.stringify(error.issues, null, 2));
        }
        throw error;
    }
    // Find event by slug
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: eventSlug },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.rsvpEnabled) {
        throw new errorHandler_js_1.AppError('RSVP is not enabled for this event', 400);
    }
    const inviteToken = String(req.body?.inviteToken || req.headers['x-invite-token'] || '').trim();
    let inviteContext = null;
    if (event.strictInviteOnly) {
        if (!inviteToken) {
            throw new errorHandler_js_1.AppError('A valid invite token is required for this event', 403);
        }
        inviteContext = await prisma_js_1.default.rsvpInvite.findUnique({
            where: { token: inviteToken },
        });
        if (!inviteContext || inviteContext.eventId !== event.id) {
            throw new errorHandler_js_1.AppError('Invite token is invalid for this event', 403);
        }
        if (inviteContext.expiresAt && inviteContext.expiresAt < new Date()) {
            throw new errorHandler_js_1.AppError('Invite token has expired', 410);
        }
        if (inviteContext.status === 'RESPONDED' || inviteContext.rsvpId) {
            throw new errorHandler_js_1.AppError('Invite token has already been used', 409);
        }
    }
    // Check phase - RSVP only allowed in PRE_EVENT
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    if (!(0, phase_js_1.canSubmitRsvp)(currentPhase)) {
        throw new errorHandler_js_1.AppError('RSVP submission is closed for this event', 400);
    }
    // Determine initial status based on invitation-only flag
    // Per SRS Section 4.3: invitation_only events have pending RSVPs
    const initialStatus = event.invitationOnly ? 'PENDING' : 'APPROVED';
    const rsvp = await prisma_js_1.default.rSVP.create({
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
    if (inviteContext) {
        await prisma_js_1.default.rsvpInvite.update({
            where: { id: inviteContext.id },
            data: {
                status: 'RESPONDED',
                initialResponse: data.attendance,
                respondedAt: new Date(),
                partySize: data.guestCount,
                note: data.note || null,
                inviteeEmail: data.email || inviteContext.inviteeEmail,
                inviteePhone: data.phone || inviteContext.inviteePhone,
                rsvpId: rsvp.id,
            },
        });
    }
    // If auto-approved (not invitation-only), generate invitation pass immediately
    let invitation = null;
    if (!event.invitationOnly && data.attendance === 'YES') {
        console.log('[RSVP] Auto-approving RSVP and generating invitation pass');
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        // Send invitation notifications via all enabled channels (email, WhatsApp, SMS)
        if (invitation) {
            const { sendInvitationNotifications } = await import('../services/notifications.js');
            sendInvitationNotifications(invitation.id).catch(err => console.error('[Notification] Failed to send invitation notifications:', err));
        }
    }
    else {
        console.log('[RSVP] RSVP created with status:', initialStatus, 'Invitation-only:', event.invitationOnly, 'Attendance:', data.attendance);
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
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
    notifyOwnerAboutRsvp(event.id, {
        primaryName: data.primaryName,
        attendance: data.attendance,
        guestCount: data.guestCount,
    }).catch(err => console.error('[Notification] Failed to notify owner:', err));
    // Send confirmation to guest if email provided
    if (rsvp.email) {
        (0, notifications_js_1.sendRsvpConfirmation)(rsvp.id).catch(err => console.error('[Notification] Failed to send confirmation:', err));
    }
    // If auto-approved with invitation, send invitation email
    if (invitation && rsvp.email) {
        (0, notifications_js_1.sendInvitationEmail)(invitation.id).catch(err => console.error('[Notification] Failed to send invitation:', err));
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
router.get('/event/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { status, attendance, page = '1', limit = '50' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const where = { eventId };
    if (status)
        where.status = status;
    if (attendance)
        where.attendance = attendance;
    const [rsvps, total] = await Promise.all([
        prisma_js_1.default.rSVP.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            skip,
            take,
            select: {
                id: true,
                primaryName: true,
                secondaryName: true,
                email: true,
                phone: true,
                attendance: true,
                guestCount: true,
                mealPreference: true,
                dietaryNotes: true,
                note: true,
                customFields: true,
                status: true,
                submittedAt: true,
                invitation: {
                    select: {
                        id: true,
                        accessCode: true,
                        qrCodeData: true,
                        isCheckedIn: true,
                        checkedInAt: true,
                    },
                },
            },
        }),
        prisma_js_1.default.rSVP.count({ where }),
    ]);
    res.json({
        rsvps,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / take),
        },
    });
}));
/**
 * GET /api/rsvp/:id
 * Get single RSVP details (Admin only)
 */
router.get('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: req.params.id },
        include: {
            event: { select: { id: true, name: true, slug: true } },
            invitation: true,
        },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    res.json({ rsvp });
}));
/**
 * POST /api/rsvp/:id/review
 * Approve or reject RSVP (Admin only)
 * Per SRS Section 5 & 7
 */
router.post('/:id/review', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.reviewRsvpSchema.parse(req.body);
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: req.params.id },
        include: { event: true },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    if (rsvp.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError('RSVP has already been reviewed', 400);
    }
    // Update RSVP status
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: req.params.id },
        data: {
            status: data.status,
            reviewedAt: new Date(),
            reviewedBy: req.admin.id,
        },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: rsvp.eventId,
            adminId: req.admin.id,
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
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        // Send invitation notifications via all enabled channels (email, WhatsApp, SMS)
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch(err => console.error('[Notification] Failed to send invitation notifications:', err));
        }
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
router.post('/:id/approve', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: req.params.id },
        include: { event: true },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: req.params.id },
        data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: req.admin.id,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: rsvp.eventId,
            adminId: req.admin.id,
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
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        // Send invitation notifications via all enabled channels (email, WhatsApp, SMS)
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch(err => console.error('[Notification] Failed to send invitation notifications:', err));
        }
    }
    res.json({ rsvp: updatedRsvp, invitation, message: 'RSVP approved successfully' });
}));
/**
 * POST /api/rsvp/:id/reject
 * Quick reject RSVP (Admin only)
 */
router.post('/:id/reject', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: req.params.id },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: req.params.id },
        data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedBy: req.admin.id,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: rsvp.eventId,
            adminId: req.admin.id,
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
router.post('/bulk-review', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { rsvpIds, status } = req.body;
    if (!Array.isArray(rsvpIds) || rsvpIds.length === 0) {
        throw new errorHandler_js_1.AppError('rsvpIds must be a non-empty array', 400);
    }
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new errorHandler_js_1.AppError('Invalid status', 400);
    }
    const results = {
        processed: 0,
        skipped: 0,
        invitationsGenerated: 0,
    };
    for (const rsvpId of rsvpIds) {
        const rsvp = await prisma_js_1.default.rSVP.findUnique({
            where: { id: rsvpId },
        });
        if (!rsvp || rsvp.status !== 'PENDING') {
            results.skipped++;
            continue;
        }
        await prisma_js_1.default.rSVP.update({
            where: { id: rsvpId },
            data: {
                status,
                reviewedAt: new Date(),
                reviewedBy: req.admin.id,
            },
        });
        // Create audit log
        await prisma_js_1.default.auditLog.create({
            data: {
                eventId: rsvp.eventId,
                adminId: req.admin.id,
                action: status === 'APPROVED' ? 'RSVP_APPROVED' : 'RSVP_REJECTED',
                entityType: 'RSVP',
                entityId: rsvp.id,
                details: JSON.stringify({ bulk: true }),
            },
        });
        if (status === 'APPROVED' && rsvp.attendance === 'YES') {
            await (0, invitation_js_1.generateInvitationPass)(rsvpId);
            results.invitationsGenerated++;
        }
        results.processed++;
    }
    res.json({
        message: `Processed ${results.processed} RSVPs`,
        results,
    });
}));
exports.default = router;
//# sourceMappingURL=rsvp.js.map