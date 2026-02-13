import { Router } from 'express';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { calculateEventPhase } from '../utils/phase.js';
import { z } from 'zod';
import { sendInvitationNotifications, sendWhatsAppRsvpInvite } from '../services/notifications.js';
import { generateInvitationPass } from '../services/invitation.js';

const router = Router();

// All routes require owner authentication
router.use(authenticateOwnerAccount);

const normalizeDomainHost = (rawHost: string) =>
  rawHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

const isValidDomainHost = (host: string) =>
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);

const getInvitePublicUrl = (token: string) => {
  const frontend = (process.env.FRONTEND_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
  if (frontend) return `${frontend}/invite/${token}`;
  return `/invite/${token}`;
};

/**
 * GET /api/owner-dashboard/events
 * Get all events for the logged-in owner
 */
router.get('/events', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  const events = await prisma.event.findMany({
    where: { ownerId },
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
          transactions: true,
          giftOrders: true,
        },
      },
      ticketTypes: {
        select: {
          id: true,
          name: true,
          price: true,
          currency: true,
          quantitySold: true,
          quantityTotal: true,
        },
      },
    },
  });

  // Calculate current phase for each event
  const eventsWithPhase = events.map((event) => ({
    ...event,
    currentPhase: calculateEventPhase(event),
  }));

  res.json({ events: eventsWithPhase });
}));

/**
 * GET /api/owner-dashboard/events/:eventId
 * Get single event details
 */
router.get('/events/:eventId', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ownerId, // Ensure owner owns this event
    },
    include: {
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
          transactions: true,
          giftOrders: true,
        },
      },
      ticketTypes: {
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          quantitySold: true,
          quantityTotal: true,
          isActive: true,
        },
      },
      domains: {
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * GET /api/owner-dashboard/stats
 * Get overall statistics for the owner
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  const events = await prisma.event.findMany({
    where: { ownerId },
    include: {
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
          giftOrders: true,
        },
      },
      transactions: {
        select: {
          grossAmount: true,
          netAmount: true,
          currency: true,
          status: true,
          type: true,
        },
      },
      giftOrders: {
        select: {
          totalAmount: true,
          currency: true,
          status: true,
        },
      },
    },
  });

  // Calculate totals
  const totalEvents = events.length;
  const totalRsvps = events.reduce((sum, e) => sum + e._count.rsvps, 0);
  const totalCheckIns = events.reduce((sum, e) => sum + e._count.checkIns, 0);
  const totalMedia = events.reduce((sum, e) => sum + e._count.mediaAssets, 0);
  const totalGiftOrders = events.reduce((sum, e) => sum + e._count.giftOrders, 0);

  // Calculate revenue
  const allTransactions = events.flatMap(e => e.transactions);
  const completedTransactions = allTransactions.filter(t => t.status === 'completed' && t.type === 'ticket_sale');
  
  const revenueByCurrency: Record<string, { gross: number; net: number }> = {};
  completedTransactions.forEach(t => {
    if (!revenueByCurrency[t.currency]) {
      revenueByCurrency[t.currency] = { gross: 0, net: 0 };
    }
    revenueByCurrency[t.currency].gross += t.grossAmount;
    revenueByCurrency[t.currency].net += t.netAmount;
  });

  const giftingByCurrency: Record<string, { total: number; orders: number }> = {};
  events.flatMap((e) => e.giftOrders).forEach((order) => {
    if (order.status !== 'PAID') return;
    if (!giftingByCurrency[order.currency]) {
      giftingByCurrency[order.currency] = { total: 0, orders: 0 };
    }
    giftingByCurrency[order.currency].total += order.totalAmount;
    giftingByCurrency[order.currency].orders += 1;
  });

  res.json({
    stats: {
      totalEvents,
      totalRsvps,
      totalCheckIns,
      totalMedia,
      totalGiftOrders,
      revenueByCurrency,
      giftingByCurrency,
    },
  });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/rsvps
 * Get RSVPs for a specific event (owner must own the event)
 */
router.get('/events/:eventId/rsvps', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const { status } = req.query;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const where: any = { eventId };
  if (status && status !== 'all') {
    where.status = status;
  }

  const rsvps = await prisma.rSVP.findMany({
    where,
    include: {
      invitation: {
        select: {
          id: true,
          accessCode: true,
          token: true,
          qrCodeData: true,
          isCheckedIn: true,
        },
      },
    },
    orderBy: { submittedAt: 'desc' },
  });

  res.json({ rsvps });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/rsvps/:rsvpId/review
 * Owner review RSVP (approve/reject)
 */
router.post('/events/:eventId/rsvps/:rsvpId/review', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId, rsvpId } = req.params;
  const status = String(req.body?.status || '').toUpperCase();

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    throw new AppError('Invalid status. Must be APPROVED or REJECTED', 400);
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true, invitationOnly: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const rsvp = await prisma.rSVP.findFirst({
    where: { id: rsvpId, eventId },
  });

  if (!rsvp) {
    throw new AppError('RSVP not found', 404);
  }

  if (rsvp.status !== 'PENDING') {
    throw new AppError('RSVP has already been reviewed', 400);
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id: rsvp.id },
    data: {
      status,
      reviewedAt: new Date(),
    },
  });

  let invitation = null;
  if (status === 'APPROVED' && rsvp.attendance === 'YES') {
    invitation = await generateInvitationPass(rsvp.id);
    if (invitation) {
      sendInvitationNotifications(invitation.id).catch((err) =>
        console.error('[Owner RSVP Review] Failed to send invitation notifications:', err)
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      action: status === 'APPROVED' ? 'RSVP_APPROVED_BY_OWNER' : 'RSVP_REJECTED_BY_OWNER',
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({
        ownerId,
        guestName: rsvp.primaryName,
      }),
    },
  });

  res.json({
    rsvp: updatedRsvp,
    invitation,
    message: status === 'APPROVED' ? 'RSVP approved successfully' : 'RSVP rejected successfully',
  });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/media
 * Get media for a specific event (owner must own the event)
 */
router.get('/events/:eventId/media', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const { type } = req.query;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const where: any = { eventId };
  if (type) {
    where.type = type;
  }

  const { downloadFile, BUCKETS, getPublicUrl } = await import('../services/supabaseStorage.js');

  const media = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Transform media to include proper URLs
  const mediaWithUrls = media.map(asset => {
    let fileUrl = asset.filePath;
    if (!asset.filePath.startsWith('http://') && !asset.filePath.startsWith('https://')) {
      try {
        fileUrl = getPublicUrl(BUCKETS.MEDIA, asset.filePath);
      } catch {
        fileUrl = asset.filePath.startsWith('/') ? asset.filePath : `/${asset.filePath}`;
      }
    }

    let thumbnailUrl = asset.thumbnailPath;
    if (asset.thumbnailPath && !asset.thumbnailPath.startsWith('http://') && !asset.thumbnailPath.startsWith('https://')) {
      try {
        thumbnailUrl = getPublicUrl(BUCKETS.MEDIA, asset.thumbnailPath);
      } catch {
        thumbnailUrl = asset.thumbnailPath.startsWith('/') ? asset.thumbnailPath : `/${asset.thumbnailPath}`;
      }
    }

    return {
      ...asset,
      filePath: fileUrl,
      thumbnailPath: thumbnailUrl,
    };
  });

  res.json({ media: mediaWithUrls });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/domains
 * Get custom domains for an owner event
 */
router.get('/events/:eventId/domains', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const domains = await prisma.eventDomain.findMany({
    where: { eventId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });

  res.json({
    domains,
    dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
  });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/domains
 * Add custom domain for owner event
 */
router.post('/events/:eventId/domains', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const host = normalizeDomainHost(String(req.body?.host || ''));
  const isPrimary = Boolean(req.body?.isPrimary);

  if (!isValidDomainHost(host)) {
    throw new AppError('Please provide a valid domain host', 400);
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const existing = await prisma.eventDomain.findUnique({ where: { host } });
  if (existing) throw new AppError('Domain is already connected to another event', 400);

  if (isPrimary) {
    await prisma.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
  }

  const domain = await prisma.eventDomain.create({
    data: {
      eventId,
      host,
      isPrimary,
      verificationToken: randomBytes(16).toString('hex'),
      status: 'PENDING_VERIFICATION',
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_ADDED_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ ownerId, host }),
    },
  });

  res.status(201).json({
    domain,
    verification: {
      txtName: `_eventpeepo.${host}`,
      txtValue: domain.verificationToken,
      cnameName: host.startsWith('www.') ? host : `www.${host}`,
      cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
    },
  });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/domains/:domainId/verify
 * Verify domain DNS
 */
router.post('/events/:eventId/domains/:domainId/verify', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId, domainId } = req.params;
  const cnameTarget = (process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com').toLowerCase();

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });
  if (!domain) throw new AppError('Domain not found', 404);

  let txtMatch = false;
  let cnameMatch = false;
  try {
    const txtRecords = await dns.resolveTxt(`_eventpeepo.${domain.host}`);
    txtMatch = txtRecords.flat().map((v) => v.trim()).includes(domain.verificationToken);
  } catch {
    txtMatch = false;
  }
  try {
    const cnameHost = domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`;
    const cnameRecords = await dns.resolveCname(cnameHost);
    cnameMatch = cnameRecords.some((record) =>
      record.toLowerCase().replace(/\.$/, '') === cnameTarget.replace(/\.$/, '')
    );
  } catch {
    cnameMatch = false;
  }

  const verified = txtMatch && cnameMatch;
  const status = verified ? (domain.isPrimary ? 'ACTIVE' : 'VERIFIED') : 'FAILED';
  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: {
      status,
      verificationNotes: verified ? null : 'TXT and/or CNAME records do not match yet',
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_VERIFIED_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ ownerId, host: domain.host, status, txtMatch, cnameMatch }),
    },
  });

  res.json({
    domain: updated,
    verification: { verified, txtMatch, cnameMatch },
  });
}));

/**
 * PATCH /api/owner-dashboard/events/:eventId/domains/:domainId/primary
 */
router.patch('/events/:eventId/domains/:domainId/primary', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId, domainId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });
  if (!domain) throw new AppError('Domain not found', 404);
  if (!['VERIFIED', 'ACTIVE'].includes(domain.status)) {
    throw new AppError('Only verified domains can be made primary', 400);
  }

  await prisma.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: { isPrimary: true, status: 'ACTIVE' },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_SET_PRIMARY_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ ownerId, host: domain.host }),
    },
  });

  res.json({ domain: updated });
}));

/**
 * DELETE /api/owner-dashboard/events/:eventId/domains/:domainId
 */
router.delete('/events/:eventId/domains/:domainId', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId, domainId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });
  if (!domain) throw new AppError('Domain not found', 404);

  await prisma.eventDomain.delete({ where: { id: domain.id } });

  if (domain.isPrimary) {
    const fallback = await prisma.eventDomain.findFirst({
      where: { eventId, status: { in: ['VERIFIED', 'ACTIVE'] } },
      orderBy: { createdAt: 'asc' },
    });
    if (fallback) {
      await prisma.eventDomain.update({
        where: { id: fallback.id },
        data: { isPrimary: true, status: 'ACTIVE' },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_DELETED_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ ownerId, host: domain.host }),
    },
  });

  res.json({ message: 'Domain removed successfully' });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/rsvp-invites
 * List RSVP invite statuses
 */
router.get('/events/:eventId/rsvp-invites', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const invites = await prisma.rsvpInvite.findMany({
    where: { eventId },
    include: {
      rsvp: {
        select: {
          id: true,
          attendance: true,
          status: true,
          guestCount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ invites });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/batch
 * Create and send invite batch
 */
router.post('/events/:eventId/rsvp-invites/batch', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const invitesInput = Array.isArray(req.body?.invites) ? req.body.invites : [];
  const expiresInHours = Number(req.body?.expiresInHours || 240);

  if (!invitesInput.length) {
    throw new AppError('invites must be a non-empty array', 400);
  }

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });
  if (!event) throw new AppError('Event not found', 404);

  const created: any[] = [];
  const failed: Array<{ phone: string; reason: string }> = [];

  for (const input of invitesInput) {
    const inviteePhone = String(input?.phone || '').trim();
    const inviteeName = input?.name ? String(input.name).trim() : null;
    const inviteeEmail = input?.email ? String(input.email).trim() : null;

    if (!inviteePhone) {
      failed.push({ phone: '', reason: 'Phone number is required' });
      continue;
    }

    const token = randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + Math.max(expiresInHours, 1) * 60 * 60 * 1000);

    const invite = await prisma.rsvpInvite.create({
      data: {
        eventId,
        token,
        inviteeName,
        inviteePhone,
        inviteeEmail,
        expiresAt,
        status: 'SENT',
        sentByOwnerId: ownerId,
      },
    });

    const inviteUrl = getInvitePublicUrl(invite.token);
    try {
      const delivery = await sendWhatsAppRsvpInvite(inviteePhone, {
        eventName: event.name,
        inviteUrl,
        token: invite.token,
      });
      if (!delivery.success) {
        failed.push({
          phone: inviteePhone,
          reason: ('error' in delivery && delivery.error) ? delivery.error : 'Failed to send WhatsApp invite',
        });
        continue;
      }
      created.push(invite);
    } catch (error: any) {
      failed.push({ phone: inviteePhone, reason: error?.message || 'Failed to send WhatsApp invite' });
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'RSVP_INVITE_BATCH_SENT_BY_OWNER',
      entityType: 'RSVP_INVITE',
      details: JSON.stringify({
        ownerId,
        sentCount: created.length,
        failedCount: failed.length,
      }),
    },
  });

  res.status(201).json({
    message: 'Invite batch processed',
    sentCount: created.length,
    failedCount: failed.length,
    invites: created,
    failed,
  });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/:inviteId/resend
 * Resend a single invite
 */
router.post('/events/:eventId/rsvp-invites/:inviteId/resend', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId, inviteId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true, name: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const invite = await prisma.rsvpInvite.findFirst({
    where: { id: inviteId, eventId },
  });
  if (!invite) throw new AppError('Invite not found', 404);

  const inviteUrl = getInvitePublicUrl(invite.token);
  const delivery = await sendWhatsAppRsvpInvite(invite.inviteePhone, {
    eventName: event.name,
    inviteUrl,
    token: invite.token,
    reminder: true,
  });
  if (!delivery.success) {
    throw new AppError(
      ('error' in delivery && delivery.error) ? delivery.error : 'Failed to resend invite',
      500
    );
  }
  const updated = await prisma.rsvpInvite.update({
    where: { id: invite.id },
    data: {
      status: 'SENT',
      updatedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'RSVP_INVITE_RESENT_BY_OWNER',
      entityType: 'RSVP_INVITE',
      entityId: invite.id,
      details: JSON.stringify({ ownerId, inviteePhone: invite.inviteePhone }),
    },
  });

  res.json({ invite: updated, message: 'Invite resent successfully' });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/checkins
 * Get check-ins for a specific event (owner must own the event)
 */
router.get('/events/:eventId/checkins', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const checkIns = await prisma.checkIn.findMany({
    where: { eventId },
    include: {
      invitation: {
        select: {
          guestName: true,
          guestCount: true,
          accessCode: true,
        },
      },
    },
    orderBy: { checkedInAt: 'desc' },
  });

  res.json({ checkIns });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/tickets
 * Get tickets for a specific event (owner must own the event)
 */
router.get('/events/:eventId/tickets', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const tickets = await prisma.ticketType.findMany({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ tickets });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/gift-orders
 * Get gift orders for a specific event
 */
router.get('/events/:eventId/gift-orders', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const orders = await prisma.giftOrder.findMany({
    where: { eventId },
    include: {
      items: {
        include: {
          giftPackage: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ orders });
}));

/**
 * GET /api/owner-dashboard/wallet
 * Get wallet configuration for the logged-in owner
 */
router.get('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  res.json({ wallet: owner.wallet || null });
}));

/**
 * POST /api/owner-dashboard/wallet
 * Create or update wallet configuration for the logged-in owner
 */
router.post('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  const walletSchema = z.object({
    // Bank Account Details
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    
    // Mobile Money
    mobileProvider: z.enum(['mpesa', 'mtn', 'airtel']).optional(),
    mobileNumber: z.string().optional(),
    
    // Digital Wallets
    paypalEmail: z.string().email().optional(),
    stripeAccountId: z.string().optional(),
    paystackSubaccount: z.string().optional(),
    
    // Payout Preferences
    preferredMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).default('bank'),
    currency: z.string().default('USD'),
    autoPayoutEnabled: z.boolean().optional(),
    autoPayoutThreshold: z.number().optional(),
  });
  
  const data = walletSchema.parse(req.body);
  
  const wallet = await (prisma as any).ownerWallet.upsert({
    where: { ownerId },
    create: {
      ownerId,
      ...data,
    },
    update: data,
  });
  
  // Create audit log (owner actions don't require audit log in current schema)
  // Audit logs are primarily for admin actions
  
  res.json({ wallet, message: 'Wallet configuration saved successfully' });
}));

/**
 * GET /api/owner-dashboard/payouts
 * Get all payout requests for the logged-in owner with totals
 */
router.get('/payouts', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  // Get all events owned by this owner
  const events = await prisma.event.findMany({
    where: { ownerId },
    select: { 
      id: true,
      name: true,
      slug: true,
    },
  });

  const eventIds = events.map(e => e.id);

  // Get all payout requests for these events
  const payouts = await prisma.payoutRequest.findMany({
    where: {
      eventId: { in: eventIds },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Calculate totals per event and overall
  const eventTotals = await Promise.all(
    events.map(async (event) => {
      // Get all transactions for this event
      const transactions = await prisma.transaction.findMany({
        where: {
          eventId: event.id,
          type: 'ticket_sale',
          status: 'completed',
        },
      });

      // Calculate total net amount (available for payout)
      const totalNet = transactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);

      // Get all payout requests for this event
      const eventPayouts = payouts.filter(p => p.eventId === event.id);
      
      // Calculate fulfilled payout amount (status: FULFILLED)
      const fulfilledAmount = eventPayouts
        .filter(p => p.status === 'FULFILLED')
        .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
      
      // Calculate pending/processing payout amount
      const pendingAmount = eventPayouts
        .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING' || p.status === 'DELAYED')
        .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);

      // Available balance = totalNet - fulfilledAmount - pendingAmount
      const availableBalance = totalNet - fulfilledAmount - pendingAmount;

      return {
        eventId: event.id,
        eventName: event.name,
        eventSlug: event.slug,
        totalNet,
        fulfilledAmount,
        pendingAmount,
        availableBalance,
        payoutCount: eventPayouts.length,
      };
    })
  );

  // Calculate overall totals
  const overallTotals = {
    totalNet: eventTotals.reduce((sum, e) => sum + e.totalNet, 0),
    fulfilledAmount: eventTotals.reduce((sum, e) => sum + e.fulfilledAmount, 0),
    pendingAmount: eventTotals.reduce((sum, e) => sum + e.pendingAmount, 0),
    availableBalance: eventTotals.reduce((sum, e) => sum + e.availableBalance, 0),
    totalPayoutCount: payouts.length,
  };

  res.json({ 
    payouts,
    eventTotals,
    overallTotals,
  });
}));

/**
 * POST /api/owner-dashboard/payouts
 * Create a new payout request
 */
router.post('/payouts', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const payoutSchema = z.object({
    eventId: z.string().uuid(),
    requestedAmount: z.number().positive(),
    currency: z.string().default('USD'),
    payoutMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']),
    notes: z.string().optional(),
  });
  
  const data = payoutSchema.parse(req.body);
  
  // Verify event belongs to owner
  const event = await prisma.event.findFirst({
    where: {
      id: data.eventId,
      ownerId,
    },
  });
  
  if (!event) {
    throw new AppError('Event not found or you do not have access', 404);
  }
  
  // Get wallet configuration to verify payout method
  const wallet = await (prisma as any).ownerWallet.findUnique({
    where: { ownerId },
  });
  
  if (!wallet) {
    throw new AppError('Wallet configuration required. Please set up your wallet first.', 400);
  }
  
  // Check if preferred method matches request
  if (wallet.preferredMethod !== data.payoutMethod) {
    // Allow override but warn (optional check)
  }
  
  // Calculate available balance for this event
  const transactions = await prisma.transaction.findMany({
    where: {
      eventId: data.eventId,
      type: 'ticket_sale',
      status: 'completed',
    },
  });
  
  const totalNet = transactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
  
  // Get existing payout requests for this event
  const existingPayouts = await prisma.payoutRequest.findMany({
    where: {
      eventId: data.eventId,
      status: { in: ['PENDING', 'PROCESSING', 'FULFILLED', 'DELAYED'] },
    },
  });
  
  const fulfilledAmount = existingPayouts
    .filter(p => p.status === 'FULFILLED')
    .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
  
  const pendingAmount = existingPayouts
    .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING' || p.status === 'DELAYED')
    .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
  
  const availableBalance = totalNet - fulfilledAmount - pendingAmount;
  
  if (data.requestedAmount > availableBalance) {
    throw new AppError(
      `Requested amount (${data.currency} ${data.requestedAmount.toFixed(2)}) exceeds available balance (${data.currency} ${availableBalance.toFixed(2)})`,
      400
    );
  }
  
  // Create payout request
  const payout = await prisma.payoutRequest.create({
    data: {
      eventId: data.eventId,
      requestedAmount: data.requestedAmount,
      currency: data.currency,
      payoutMethod: data.payoutMethod,
      notes: data.notes,
      status: 'PENDING',
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
  
  res.status(201).json({ payout });
}));

export default router;

