import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateInvitationPass } from '../services/invitation.js';
import { sendInvitationNotifications } from '../services/notifications.js';

const router = Router();

const parseTokenFromText = (value: string) => {
  const trimmed = value.trim();
  const payloadMatch = trimmed.match(/RSVP:(YES|NO):([a-zA-Z0-9]+)/i);
  if (payloadMatch) {
    return { attendance: payloadMatch[1].toUpperCase() as 'YES' | 'NO', token: payloadMatch[2] };
  }

  const shortMatch = trimmed.match(/^(YES|NO)\s+([a-zA-Z0-9]+)/i);
  if (shortMatch) {
    return { attendance: shortMatch[1].toUpperCase() as 'YES' | 'NO', token: shortMatch[2] };
  }

  return null;
};

const processInviteResponse = async (token: string, attendance: 'YES' | 'NO') => {
  const invite = await prisma.rsvpInvite.findUnique({
    where: { token },
    include: { event: true },
  });

  if (!invite) return { ok: false, reason: 'invite_not_found' };
  if (invite.expiresAt && invite.expiresAt < new Date()) return { ok: false, reason: 'invite_expired' };
  if (invite.status === 'RESPONDED' || invite.rsvpId) return { ok: true, duplicate: true };

  const status = invite.event.invitationOnly ? 'PENDING' : 'APPROVED';
  const rsvp = await prisma.rSVP.create({
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

  await prisma.rsvpInvite.update({
    where: { id: invite.id },
    data: {
      status: 'RESPONDED',
      initialResponse: attendance,
      respondedAt: new Date(),
      rsvpId: rsvp.id,
    },
  });

  if (attendance === 'YES' && status === 'APPROVED') {
    const invitation = await generateInvitationPass(rsvp.id);
    if (invitation) {
      sendInvitationNotifications(invitation.id).catch((err) =>
        console.error('[WhatsApp Webhook] Failed sending invitation notifications:', err)
      );
    }
  }

  await prisma.auditLog.create({
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

const recordWebhookEvent = async (provider: 'META' | 'TWILIO', providerMessageId: string, payload: any) => {
  try {
    await prisma.whatsappWebhookEvent.create({
      data: {
        provider,
        providerMessageId,
        eventType: 'MESSAGE',
        payload: JSON.stringify(payload),
        processedAt: new Date(),
      },
    });
    return true;
  } catch (error: any) {
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
router.get('/meta', asyncHandler(async (req, res) => {
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
router.post('/meta', asyncHandler(async (req, res) => {
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const messages = Array.isArray(change?.value?.messages) ? change.value.messages : [];
      for (const message of messages) {
        const messageId = String(message?.id || '');
        if (!messageId) continue;

        const created = await recordWebhookEvent('META', messageId, message);
        if (!created) continue;

        const interactiveId = message?.interactive?.button_reply?.id
          || message?.interactive?.list_reply?.id
          || '';
        const textBody = message?.text?.body || '';
        const parsed = parseTokenFromText(interactiveId || textBody);
        if (!parsed) continue;

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
router.post('/twilio', asyncHandler(async (req, res) => {
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

export default router;
