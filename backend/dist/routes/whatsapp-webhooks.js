"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const invitation_js_1 = require("../services/invitation.js");
const notifications_js_1 = require("../services/notifications.js");
const router = (0, express_1.Router)();
const parseTokenFromText = (value) => {
    const trimmed = value.trim();
    const payloadMatch = trimmed.match(/RSVP:(YES|NO):([a-zA-Z0-9]+)/i);
    if (payloadMatch) {
        return { attendance: payloadMatch[1].toUpperCase(), token: payloadMatch[2] };
    }
    const shortMatch = trimmed.match(/^(YES|NO)\s+([a-zA-Z0-9]+)/i);
    if (shortMatch) {
        return { attendance: shortMatch[1].toUpperCase(), token: shortMatch[2] };
    }
    return null;
};
const processInviteResponse = async (token, attendance) => {
    const invite = await prisma_js_1.default.rsvpInvite.findUnique({
        where: { token },
        include: { event: true },
    });
    if (!invite)
        return { ok: false, reason: 'invite_not_found' };
    if (invite.expiresAt && invite.expiresAt < new Date())
        return { ok: false, reason: 'invite_expired' };
    if (invite.status === 'RESPONDED' || invite.rsvpId)
        return { ok: true, duplicate: true };
    const status = invite.event.invitationOnly ? 'PENDING' : 'APPROVED';
    const rsvp = await prisma_js_1.default.rSVP.create({
        data: {
            eventId: invite.eventId,
            primaryName: invite.inviteeName || 'Guest',
            email: invite.inviteeEmail || null,
            phone: invite.inviteePhone || null,
            attendance,
            guestCount: invite.partySize || 1,
            note: invite.note || null,
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
            rsvpId: rsvp.id,
        },
    });
    if (attendance === 'YES' && status === 'APPROVED') {
        const invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch((err) => console.error('[WhatsApp Webhook] Failed sending invitation notifications:', err));
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: invite.eventId,
            action: 'RSVP_INVITE_RESPONDED_VIA_WEBHOOK',
            entityType: 'RSVP_INVITE',
            entityId: invite.id,
            details: JSON.stringify({ attendance, token }),
        },
    });
    return { ok: true, duplicate: false };
};
const recordWebhookEvent = async (provider, providerMessageId, payload) => {
    try {
        await prisma_js_1.default.whatsappWebhookEvent.create({
            data: {
                provider,
                providerMessageId,
                eventType: 'MESSAGE',
                payload: JSON.stringify(payload),
                processedAt: new Date(),
            },
        });
        return true;
    }
    catch (error) {
        // Unique constraint -> already processed
        if (String(error?.code || '').toUpperCase() === 'P2002') {
            return false;
        }
        throw error;
    }
};
/**
 * GET /api/whatsapp/meta
 * Meta webhook verification
 */
router.get('/meta', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');
    if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
}));
/**
 * POST /api/whatsapp/meta
 * Meta webhook event
 */
router.post('/meta', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    for (const entry of entries) {
        const changes = Array.isArray(entry?.changes) ? entry.changes : [];
        for (const change of changes) {
            const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
            for (const message of messages) {
                const messageId = String(message?.id || '');
                if (!messageId)
                    continue;
                const created = await recordWebhookEvent('META', messageId, message);
                if (!created)
                    continue;
                const interactiveId = message?.interactive?.button_reply?.id
                    || message?.interactive?.list_reply?.id
                    || '';
                const textBody = message?.text?.body || '';
                const parsed = parseTokenFromText(interactiveId || textBody);
                if (!parsed)
                    continue;
                await processInviteResponse(parsed.token, parsed.attendance);
            }
        }
    }
    res.status(200).json({ received: true });
}));
/**
 * POST /api/whatsapp/twilio
 * Twilio WhatsApp webhook event
 */
router.post('/twilio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const messageId = String(req.body?.MessageSid || req.body?.SmsSid || '');
    if (!messageId) {
        return res.status(200).send('ok');
    }
    const created = await recordWebhookEvent('TWILIO', messageId, req.body);
    if (!created) {
        return res.status(200).send('ok');
    }
    const body = String(req.body?.Body || req.body?.ButtonText || '').trim();
    const parsed = parseTokenFromText(body);
    if (parsed) {
        await processInviteResponse(parsed.token, parsed.attendance);
    }
    return res.status(200).send('ok');
}));
exports.default = router;
//# sourceMappingURL=whatsapp-webhooks.js.map