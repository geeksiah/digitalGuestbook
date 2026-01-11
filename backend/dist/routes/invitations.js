"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const invitation_js_1 = require("../services/invitation.js");
const router = (0, express_1.Router)();
/**
 * GET /api/invitations/event/:eventId
 * List all invitations for an event (Admin only)
 */
router.get('/event/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { checkedIn } = req.query;
    const where = { eventId };
    if (checkedIn === 'true')
        where.isCheckedIn = true;
    if (checkedIn === 'false')
        where.isCheckedIn = false;
    const invitations = await prisma_js_1.default.invitation.findMany({
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
router.get('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const invitation = await prisma_js_1.default.invitation.findUnique({
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
        throw new errorHandler_js_1.AppError('Invitation not found', 404);
    }
    res.json({ invitation });
}));
/**
 * GET /api/invitations/:id/pdf
 * Download invitation PDF
 */
router.get('/:id/pdf', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const invitation = await prisma_js_1.default.invitation.findUnique({
        where: { id: req.params.id },
        include: { event: true },
    });
    if (!invitation) {
        throw new errorHandler_js_1.AppError('Invitation not found', 404);
    }
    const pdfPath = await (0, invitation_js_1.getInvitationPDF)(invitation.id);
    res.download(pdfPath, `invitation-${invitation.event.slug}-${invitation.accessCode}.pdf`);
}));
/**
 * GET /api/invitations/by-code/:accessCode
 * Lookup invitation by access code (for check-in)
 */
router.get('/by-code/:accessCode', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const invitation = await prisma_js_1.default.invitation.findUnique({
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
        throw new errorHandler_js_1.AppError('Invalid access code', 404);
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
router.get('/by-token/:token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const invitation = await prisma_js_1.default.invitation.findUnique({
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
        throw new errorHandler_js_1.AppError('Invalid invitation token', 404);
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
router.post('/regenerate/:rsvpId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { rsvpId } = req.params;
    const rsvp = await prisma_js_1.default.rSVP.findUnique({
        where: { id: rsvpId },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    if (rsvp.status !== 'APPROVED') {
        throw new errorHandler_js_1.AppError('RSVP must be approved to generate invitation', 400);
    }
    // Delete existing invitation if any
    await prisma_js_1.default.invitation.deleteMany({
        where: { rsvpId },
    });
    // Generate new invitation
    const invitation = await (0, invitation_js_1.generateInvitationPass)(rsvpId);
    res.json({ invitation });
}));
exports.default = router;
//# sourceMappingURL=invitations.js.map