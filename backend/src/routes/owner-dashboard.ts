import { Router } from 'express';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import {
  checkCustomDomainOnNetlify,
  isNetlifyDomainAutomationConfigured,
  provisionCustomDomainOnNetlify,
  removeCustomDomainFromNetlify,
} from '../services/customDomainHosting.js';
import { buildDomainVerificationNote, verifyCustomDomainDns } from '../services/customDomainDns.js';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { calculateEventPhase } from '../utils/phase.js';
import { featureFlags } from '../utils/featureFlags.js';
import { buildSiteUrl } from '../utils/siteUrl.js';
import { z } from 'zod';
import { sendInvitationNotifications, sendWhatsAppRsvpInvite, sendEmailRsvpInvite, sendSmsRsvpInvite } from '../services/notifications.js';
import { generateInvitationPass } from '../services/invitation.js';
import {
  getOrCreateOwnerNotificationPreference,
  registerOwnerDevice,
  unregisterOwnerDevice,
  updateOwnerNotificationPreference,
} from '../services/ownerNotifications.js';
import {
  createPaystackTransferRecipient,
  createPaystackSubaccount,
  getPaystackBanks,
  resolvePaystackAccount,
  updatePaystackSubaccount,
} from '../services/paystack.js';
import {
  getPayoutAccountProvider,
  listPayoutAccountGateways,
} from '../services/payoutAccounts.js';
import { queuePaystackTransferForPayout } from '../services/payoutAutomation.js';
import {
  getAvailableWalletTypes,
  isManualWalletType,
  normalizeWalletType,
  resolveOwnerWalletState,
} from '../utils/walletPolicy.js';

const router = Router();

// All routes require owner authentication
router.use(authenticateOwnerAccount);

const normalizeDomainHost = (rawHost: string) =>
  rawHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '')
    .replace(/\.$/, '');

const isValidDomainHost = (host: string) =>
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);

// Invite links are opened from an email or a chat app, so they must always be
// absolute. `/invite/:token` is a platform route, not an event route, so it
// stays on the app host even when the event has its own domain.
const getInvitePublicUrl = (token: string) => buildSiteUrl(`/invite/${token}`);

const eventCreateSchema = z.object({
  name: z.string().min(2, 'Event name is required'),
  slug: z
    .string()
    .min(2, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  timezone: z.string().optional(),
  venue: z.string().optional(),
  ownerName: z.string().optional(),
  ownerEmail: z.string().email().optional(),
  ownerPhone: z.string().optional(),
  organizationName: z.string().optional(),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
    .default('USD'),
});

const eventUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  date: z.coerce.date().optional(),
  endDate: z.coerce.date().nullable().optional(),
  timezone: z.string().optional(),
  venue: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  ownerEmail: z.string().email().nullable().optional(),
  ownerPhone: z.string().nullable().optional(),
  organizationName: z.string().nullable().optional(),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
    .optional(),
});

const rsvpStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
  reason: z.string().max(400).optional(),
});

export type InviteChannel = 'whatsapp' | 'sms' | 'email';

const INVITE_CHANNELS: InviteChannel[] = ['whatsapp', 'sms', 'email'];

/**
 * Invite channels are stored in one string column so any combination works
 * without a migration: "whatsapp", "sms,email", and so on. "both" is the
 * legacy value for WhatsApp + email and is still accepted.
 */
const parseInviteChannels = (value: unknown): InviteChannel[] => {
  const raw = String(value || 'whatsapp').toLowerCase();
  if (raw === 'both') return ['whatsapp', 'email'];

  const parsed = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is InviteChannel => INVITE_CHANNELS.includes(part as InviteChannel));

  return parsed.length ? Array.from(new Set(parsed)) : ['whatsapp'];
};

const inviteValidateSchema = z.object({
  invites: z.array(
    z.object({
      name: z.string().trim().optional(),
      phone: z.string().trim().optional(),
      email: z.string().trim().optional(),
    })
  ),
  // Accepts one channel, a comma-separated set, or the legacy "both".
  channel: z.string().optional().default('whatsapp'),
});

type InviteValidateRow = {
  index: number;
  name: string | null;
  phone: string;
  email: string | null;
  valid: boolean;
  errors: string[];
  duplicate: boolean;
  normalizedPhone: string;
  normalizedEmail: string | null;
};

const normalizePhone = (value: string | undefined) => String(value || '').replace(/[^\d+]/g, '');
const normalizeEmail = (value: string | undefined) => String(value || '').trim().toLowerCase();
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const transitionRsvpStatus = async ({
  eventId,
  ownerId,
  rsvpId,
  status,
  reason,
}: {
  eventId: string;
  ownerId: string;
  rsvpId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
}) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) throw new AppError('Event not found', 404);

  const rsvp = await prisma.rSVP.findFirst({
    where: { id: rsvpId, eventId },
  });
  if (!rsvp) throw new AppError('RSVP not found', 404);

  const fromStatus = String(rsvp.status || 'PENDING').toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED';
  if (fromStatus === status) {
    return { rsvp, invitation: null, transitioned: false };
  }

  const updatedRsvp = await prisma.rSVP.update({
    where: { id: rsvp.id },
    data: {
      status,
      reviewedAt: new Date(),
    },
  });

  await (prisma as any).rSVPStatusAudit.create({
    data: {
      rsvpId: rsvp.id,
      eventId,
      fromStatus,
      toStatus: status,
      reason: reason || null,
      changedByOwnerId: ownerId,
    },
  });

  let invitation = null;
  if (status === 'APPROVED' && rsvp.attendance === 'YES') {
    invitation = await generateInvitationPass(rsvp.id);
    if (invitation) {
      sendInvitationNotifications(invitation.id).catch((error) =>
        console.error('[Owner RSVP transition] Invitation send failed:', error)
      );
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      action: `RSVP_STATUS_CHANGED_BY_OWNER_${status}`,
      entityType: 'RSVP',
      entityId: rsvp.id,
      details: JSON.stringify({
        ownerId,
        fromStatus,
        toStatus: status,
        reason: reason || null,
      }),
    },
  });

  return { rsvp: updatedRsvp, invitation, transitioned: true };
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
 * POST /api/owner-dashboard/events
 * Owner creates a new event (pending admin approval when FF is enabled)
 */
router.post('/events', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const data = eventCreateSchema.parse(req.body || {});

  const approvalStatus = featureFlags.ownerEventApproval ? 'PENDING_REVIEW' : 'APPROVED';
  const approvalSubmittedAt = featureFlags.ownerEventApproval ? new Date() : null;

  const event = await prisma.event.create({
    data: {
      ownerId,
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      date: data.date,
      endDate: data.endDate || null,
      timezone: data.timezone || 'UTC',
      venue: data.venue || null,
      ownerName: data.ownerName || null,
      ownerEmail: data.ownerEmail || null,
      ownerPhone: data.ownerPhone || null,
      organizationName: data.organizationName || null,
      defaultCurrency: data.defaultCurrency || 'USD',
      approvalStatus,
      approvalSubmittedAt,
      approvalReviewedAt: null,
      approvalReviewedByAdminId: null,
      approvalRejectionReason: null,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      action: 'OWNER_EVENT_CREATED',
      entityType: 'EVENT',
      entityId: event.id,
      details: JSON.stringify({
        ownerId,
        approvalStatus: event.approvalStatus,
      }),
    },
  });

  if (featureFlags.ownerEventApproval) {
    const admins = await prisma.admin.findMany({
      select: { id: true },
    });
    for (const admin of admins) {
      await prisma.auditLog.create({
        data: {
          adminId: admin.id,
          eventId: event.id,
          action: 'OWNER_EVENT_SUBMITTED_FOR_APPROVAL',
          entityType: 'EVENT',
          entityId: event.id,
          details: JSON.stringify({
            ownerId,
          }),
        },
      });
    }
  }

  res.status(201).json({ event });
}));

/**
 * GET /api/owner-dashboard/events/check-slug?slug=xxx
 * Check if a slug is available
 */
router.get('/events/check-slug', asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!slug || slug.length < 2) {
    return res.json({ available: false, slug, reason: 'Slug must be at least 2 characters' });
  }
  const existing = await prisma.event.findFirst({
    where: { slug },
    select: { id: true },
  });
  res.json({ available: !existing, slug });
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
 * PATCH /api/owner-dashboard/events/:eventId
 * Edit owner event while pending/rejected (or anytime if approval feature disabled)
 */
router.patch('/events/:eventId', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: {
      id: true,
      approvalStatus: true,
    },
  });
  if (!event) throw new AppError('Event not found', 404);

  if (
    featureFlags.ownerEventApproval
    && event.approvalStatus === 'APPROVED'
  ) {
    throw new AppError('Approved events cannot be edited from owner quick edit', 400);
  }

  const payload = eventUpdateSchema.parse(req.body || {});
  const shouldResubmit = featureFlags.ownerEventApproval;

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: {
      ...payload,
      approvalStatus: shouldResubmit ? 'PENDING_REVIEW' : event.approvalStatus,
      approvalSubmittedAt: shouldResubmit ? new Date() : undefined,
      approvalReviewedAt: shouldResubmit ? null : undefined,
      approvalReviewedByAdminId: shouldResubmit ? null : undefined,
      approvalRejectionReason: shouldResubmit ? null : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      action: 'OWNER_EVENT_UPDATED',
      entityType: 'EVENT',
      entityId: event.id,
      details: JSON.stringify({
        ownerId,
        approvalStatus: updated.approvalStatus,
      }),
    },
  });

  res.json({ event: updated });
}));

/**
 * GET /api/owner-dashboard/events/:eventId/approval
 */
router.get('/events/:eventId/approval', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: {
      id: true,
      approvalStatus: true,
      approvalSubmittedAt: true,
      approvalReviewedAt: true,
      approvalRejectionReason: true,
      approvalReviewedByAdmin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      updatedAt: true,
    },
  });

  if (!event) throw new AppError('Event not found', 404);

  res.json({
    approval: {
      status: event.approvalStatus,
      submittedAt: event.approvalSubmittedAt,
      reviewedAt: event.approvalReviewedAt,
      rejectionReason: event.approvalRejectionReason,
      reviewedBy: event.approvalReviewedByAdmin,
      updatedAt: event.updatedAt,
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
          paymentMethod: true,
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
  const completedTransactions = allTransactions.filter(
    (t) => t.status === 'completed' && ['ticket_sale', 'gift_cash'].includes(t.type)
  );
  
  const revenueByCurrency: Record<string, { gross: number; net: number }> = {};
  completedTransactions.forEach(t => {
    if (!revenueByCurrency[t.currency]) {
      revenueByCurrency[t.currency] = { gross: 0, net: 0 };
    }
    revenueByCurrency[t.currency].gross += t.grossAmount;
    revenueByCurrency[t.currency].net += t.netAmount;
  });

  const giftingByCurrency: Record<string, { gross: number; net: number; orders: number }> = {};
  allTransactions
    .filter((t) => t.status === 'completed' && t.type === 'gift_cash')
    .forEach((t) => {
      if (!giftingByCurrency[t.currency]) {
        giftingByCurrency[t.currency] = { gross: 0, net: 0, orders: 0 };
      }
      giftingByCurrency[t.currency].gross += t.grossAmount;
      giftingByCurrency[t.currency].net += t.netAmount;
      giftingByCurrency[t.currency].orders += 1;
    });

  const autoSettledCashByCurrency: Record<string, { gross: number; net: number; orders: number }> = {};
  allTransactions
    .filter(
      (t) =>
        t.status === 'completed'
        && t.type === 'gift_cash'
        && (t.paymentMethod || '').toLowerCase() === 'paystack'
    )
    .forEach((t) => {
      if (!autoSettledCashByCurrency[t.currency]) {
        autoSettledCashByCurrency[t.currency] = { gross: 0, net: 0, orders: 0 };
      }
      autoSettledCashByCurrency[t.currency].gross += t.grossAmount;
      autoSettledCashByCurrency[t.currency].net += t.netAmount;
      autoSettledCashByCurrency[t.currency].orders += 1;
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
      autoSettledCashByCurrency,
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

  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
    throw new AppError('Invalid status. Must be PENDING, APPROVED, or REJECTED', 400);
  }

  const transition = await transitionRsvpStatus({
    eventId,
    ownerId,
    rsvpId,
    status: status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reason: req.body?.reason ? String(req.body.reason) : undefined,
  });

  res.json({
    rsvp: transition.rsvp,
    invitation: transition.invitation,
    message: transition.transitioned
      ? `RSVP status updated to ${status}`
      : `RSVP already ${status}`,
  });
}));

/**
 * PATCH /api/owner-dashboard/events/:eventId/rsvps/:rsvpId/status
 * Reversible RSVP tri-state transitions with audit trail
 */
router.patch('/events/:eventId/rsvps/:rsvpId/status', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const { eventId, rsvpId } = req.params;
  const input = rsvpStatusSchema.parse(req.body || {});

  const transition = await transitionRsvpStatus({
    eventId,
    ownerId,
    rsvpId,
    status: input.status,
    reason: input.reason,
  });

  res.json({
    rsvp: transition.rsvp,
    invitation: transition.invitation,
    transitioned: transition.transitioned,
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

  const reconciledDomains = await Promise.all(domains.map(async (domain) => {
    if (domain.status !== 'VERIFIED') return domain;
    const hosting = await checkCustomDomainOnNetlify(domain.host);
    if (!hosting.configured) return domain;
    return prisma.eventDomain.update({
      where: { id: domain.id },
      data: { status: 'ACTIVE', verificationNotes: null },
    });
  }));

  res.json({
    domains: reconciledDomains,
    dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
    apexTarget: process.env.DOMAIN_APEX_IP || '75.2.60.5',
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
      txtHost: '_eventpeepo',
      txtValue: domain.verificationToken,
      cnameName: `www.${host}`,
      cnameHost: 'www',
      cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
      apexName: host,
      apexHost: '@',
      apexValue: process.env.DOMAIN_APEX_IP || '75.2.60.5',
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
  const apexTarget = process.env.DOMAIN_APEX_IP || '75.2.60.5';

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });
  if (!domain) throw new AppError('Domain not found', 404);

  const dnsVerification = await verifyCustomDomainDns(
    domain.host,
    domain.verificationToken,
    cnameTarget,
    apexTarget,
  );
  const verified = dnsVerification.verified;
  const hosting = verified
    ? await provisionCustomDomainOnNetlify(domain.host)
    : null;

  const status: 'ACTIVE' | 'VERIFIED' | 'FAILED' = verified
    ? (hosting?.configured ? 'ACTIVE' : 'VERIFIED')
    : 'FAILED';
  const dnsNote = buildDomainVerificationNote(dnsVerification);
  const verificationNotes = dnsNote || (hosting && !hosting.configured ? hosting.error || null : null);

  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: {
      status,
      verificationNotes,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_VERIFIED_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({
        ownerId,
        host: domain.host,
        status,
        txtMatch: dnsVerification.txtMatch,
        cnameMatch: dnsVerification.cnameMatch,
        apexMatch: dnsVerification.apexMatch,
        hosting,
      }),
    },
  });

  res.json({
    domain: updated,
    verification: {
      ...dnsVerification,
      hosting,
    },
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
  if (domain.status !== 'ACTIVE') {
    throw new AppError('Only fully active HTTPS domains can be made primary', 400);
  }

  await prisma.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: { isPrimary: true },
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

  let hostingCleanup = null;
  if (isNetlifyDomainAutomationConfigured()) {
    hostingCleanup = await removeCustomDomainFromNetlify(domain.host);
    if (!hostingCleanup.aliasesRemoved) {
      throw new AppError(hostingCleanup.error || 'Failed to remove domain from Netlify', 502);
    }
  } else if (['VERIFIED', 'ACTIVE'].includes(domain.status)) {
    throw new AppError(
      'Netlify cleanup is not configured. Configure NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN before removing this hosted domain.',
      503,
    );
  }

  await prisma.eventDomain.delete({ where: { id: domain.id } });

  if (domain.isPrimary) {
    const fallback = await prisma.eventDomain.findFirst({
      where: { eventId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (fallback) {
      await prisma.eventDomain.update({
        where: { id: fallback.id },
        data: { isPrimary: true },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      action: 'EVENT_DOMAIN_DELETED_BY_OWNER',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ ownerId, host: domain.host, hostingCleanup }),
    },
  });

  res.json({ message: 'Domain removed successfully', hostingCleanup });
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

const buildInviteValidation = (invitesInput: Array<{ name?: string; phone?: string; email?: string }>, channel: string = 'whatsapp') => {
  const rows: InviteValidateRow[] = [];
  const seen = new Set<string>();
  const channels = parseInviteChannels(channel);
  const needsPhone = channels.includes('whatsapp') || channels.includes('sms');
  const needsEmail = channels.includes('email');

  invitesInput.forEach((invite, index) => {
    const normalizedPhone = normalizePhone(invite.phone);
    const normalizedEmail = invite.email ? normalizeEmail(invite.email) : null;
    const key = `${normalizedPhone || ''}::${normalizedEmail || ''}`;
    const errors: string[] = [];

    if (needsPhone && !normalizedPhone) errors.push('Phone number is required');
    if (needsEmail && !normalizedEmail) errors.push('Email is required');
    if (normalizedPhone && normalizedPhone.replace(/[^\d]/g, '').length < 6) {
      errors.push('Phone number format is invalid');
    }
    if (invite.email && (!normalizedEmail || !isValidEmail(normalizedEmail))) {
      errors.push('Email format is invalid');
    }

    const duplicate = seen.has(key);
    if (!duplicate) seen.add(key);

    rows.push({
      index,
      name: invite.name ? String(invite.name).trim() : null,
      phone: String(invite.phone || '').trim(),
      email: invite.email ? String(invite.email).trim() : null,
      valid: errors.length === 0 && !duplicate,
      errors,
      duplicate,
      normalizedPhone,
      normalizedEmail,
    });
  });

  return rows;
};

/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/validate
 * Validate invite payload and return dedupe preview
 */
router.post('/events/:eventId/rsvp-invites/validate', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const { eventId } = req.params;
  const input = inviteValidateSchema.parse(req.body || {});

  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const rows = buildInviteValidation(input.invites, input.channel);
  const summary = rows.reduce(
    (acc, row) => {
      if (row.valid) acc.valid += 1;
      if (!row.valid && row.errors.length) acc.invalid += 1;
      if (row.duplicate) acc.duplicates += 1;
      return acc;
    },
    { total: rows.length, valid: 0, invalid: 0, duplicates: 0 }
  );

  res.json({ summary, rows });
}));

/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/batch
 * Create and send invite batch
 */
router.post('/events/:eventId/rsvp-invites/batch', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const validateInput = inviteValidateSchema.parse(req.body || {});
  const invitesInput = validateInput.invites;
  const channel = validateInput.channel || 'whatsapp';
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

  const channels = parseInviteChannels(channel);
  const sendViaWhatsApp = channels.includes('whatsapp');
  const sendViaSms = channels.includes('sms');
  const sendViaEmail = channels.includes('email');
  const storedChannel = channels.join(',');

  const created: any[] = [];
  const failed: Array<{ phone: string; reason: string; index: number }> = [];
  const skipped: Array<{ phone: string; reason: string; index: number }> = [];
  const rows = buildInviteValidation(invitesInput, channel);

  for (const row of rows) {
    if (!row.valid) {
      skipped.push({
        index: row.index,
        phone: row.phone || row.email || '',
        reason: row.duplicate ? 'Duplicate invite in batch' : row.errors.join(', ') || 'Invalid invite',
      });
      continue;
    }

    const inviteePhone = row.phone || null;
    const inviteeName = row.name;
    const inviteeEmail = row.email;

    // Check for existing invite by phone or email
    const existsWhere: any = { eventId, status: { in: ['SENT', 'OPENED', 'RESPONDED'] } };
    if (inviteePhone) {
      existsWhere.inviteePhone = inviteePhone;
    } else if (inviteeEmail) {
      existsWhere.inviteeEmail = inviteeEmail;
    }
    const exists = await prisma.rsvpInvite.findFirst({
      where: existsWhere,
      select: { id: true },
    });
    if (exists) {
      skipped.push({
        index: row.index,
        phone: inviteePhone || inviteeEmail || '',
        reason: 'Invite already exists for this contact',
      });
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
        channel: storedChannel,
        expiresAt,
        status: 'SENT',
        sentByOwnerId: ownerId,
      },
    });

    const inviteUrl = getInvitePublicUrl(invite.token);
    const deliveryErrors: string[] = [];

    try {
      if (sendViaWhatsApp && inviteePhone) {
        const waDelivery = await sendWhatsAppRsvpInvite(inviteePhone, {
          eventName: event.name,
          inviteUrl,
          token: invite.token,
        });
        if (!waDelivery.success) {
          deliveryErrors.push(('error' in waDelivery && waDelivery.error) ? waDelivery.error : 'WhatsApp send failed');
        }
      }


      if (sendViaSms && inviteePhone) {
        const smsDelivery = await sendSmsRsvpInvite(inviteePhone, {
          eventName: event.name,
          inviteUrl,
          token: invite.token,
          inviteeName: inviteeName || undefined,
        });
        if (!smsDelivery.success) {
          deliveryErrors.push(smsDelivery.error || 'SMS send failed');
        }
      }

      if (sendViaEmail && inviteeEmail) {
        const emailDelivery = await sendEmailRsvpInvite(inviteeEmail, {
          eventName: event.name,
          inviteUrl,
          token: invite.token,
          inviteeName: inviteeName || undefined,
        });
        if (!emailDelivery.success) {
          deliveryErrors.push(emailDelivery.error || 'Email send failed');
        }
      }

      // Only a total failure counts: one channel getting through is a success.
      const attemptedChannels =
        (sendViaWhatsApp && inviteePhone ? 1 : 0)
        + (sendViaSms && inviteePhone ? 1 : 0)
        + (sendViaEmail && inviteeEmail ? 1 : 0);
      if (deliveryErrors.length > 0 && deliveryErrors.length >= attemptedChannels) {
        failed.push({
          index: row.index,
          phone: inviteePhone || inviteeEmail || '',
          reason: deliveryErrors.join('; '),
        });
        continue;
      }
      created.push(invite);
    } catch (error: any) {
      failed.push({
        index: row.index,
        phone: inviteePhone || inviteeEmail || '',
        reason: error?.message || 'Failed to send invite',
      });
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
        skippedCount: skipped.length,
      }),
    },
  });

  res.status(201).json({
    message: 'Invite batch processed',
    totalCount: rows.length,
    sentCount: created.length,
    failedCount: failed.length,
    skippedCount: skipped.length,
    invites: created,
    failed,
    skipped,
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
  const resendChannels = parseInviteChannels((invite as any).channel);
  let delivered = false;
  let lastError = '';

  if (resendChannels.includes('whatsapp') && invite.inviteePhone) {
    const waDelivery = await sendWhatsAppRsvpInvite(invite.inviteePhone, {
      eventName: event.name,
      inviteUrl,
      token: invite.token,
      reminder: true,
    });
    if (waDelivery.success) delivered = true;
    else lastError = ('error' in waDelivery && waDelivery.error) ? waDelivery.error : 'WhatsApp send failed';
  }

  if (resendChannels.includes('sms') && invite.inviteePhone) {
    const smsDelivery = await sendSmsRsvpInvite(invite.inviteePhone, {
      eventName: event.name,
      inviteUrl,
      token: invite.token,
      reminder: true,
      inviteeName: invite.inviteeName || undefined,
    });
    if (smsDelivery.success) delivered = true;
    else lastError = smsDelivery.error || 'SMS send failed';
  }

  if (resendChannels.includes('email') && invite.inviteeEmail) {
    const emailDelivery = await sendEmailRsvpInvite(invite.inviteeEmail, {
      eventName: event.name,
      inviteUrl,
      token: invite.token,
      reminder: true,
      inviteeName: invite.inviteeName || undefined,
    });
    if (emailDelivery.success) delivered = true;
    else lastError = emailDelivery.error || 'Email send failed';
  }

  if (!delivered) {
    throw new AppError(
      lastError || 'Failed to resend invite',
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

  const paymentRefs = orders
    .map((order) => order.paymentReference)
    .filter((ref): ref is string => Boolean(ref));

  const transactions = paymentRefs.length
    ? await prisma.transactionLegacy.findMany({
        where: {
          eventId,
          paymentRef: { in: paymentRefs },
          status: 'completed',
          type: { in: ['gift_cash', 'gift_package_sale'] },
        },
        select: {
          paymentRef: true,
          type: true,
          grossAmount: true,
          platformFee: true,
          netAmount: true,
        },
      })
    : [];

  const txByRef = new Map<string, Array<typeof transactions[number]>>();
  transactions.forEach((tx) => {
    if (!tx.paymentRef) return;
    const current = txByRef.get(tx.paymentRef) || [];
    current.push(tx);
    txByRef.set(tx.paymentRef, current);
  });

  const ordersWithEarnings = orders.map((order) => {
    const txs = order.paymentReference ? txByRef.get(order.paymentReference) || [] : [];
    const ownerNetAmount = txs
      .filter((tx) => tx.type === 'gift_cash')
      .reduce((sum, tx) => sum + tx.netAmount, 0);
    const platformFeeAmount = txs
      .filter((tx) => tx.type === 'gift_cash')
      .reduce((sum, tx) => sum + tx.platformFee, 0);
    const packageAmount = txs
      .filter((tx) => tx.type === 'gift_package_sale')
      .reduce((sum, tx) => sum + tx.grossAmount, 0);

    return {
      ...order,
      ownerNetAmount,
      platformFeeAmount,
      packageAmount,
    };
  });

  res.json({ orders: ordersWithEarnings });
}));

/**
 * GET /api/owner-dashboard/notification-preferences
 */
router.get('/notification-preferences', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const preference = await getOrCreateOwnerNotificationPreference(ownerId);
  res.json({ preferences: preference });
}));

/**
 * PATCH /api/owner-dashboard/notification-preferences
 */
router.patch('/notification-preferences', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const input = z
    .object({
      notificationsEnabled: z.boolean().optional(),
      marketingEnabled: z.boolean().optional(),
      emailEnabled: z.boolean().optional(),
      smsEnabled: z.boolean().optional(),
      pushEnabled: z.boolean().optional(),
      notifyRsvp: z.boolean().optional(),
      notifyCheckIn: z.boolean().optional(),
      notifyGift: z.boolean().optional(),
      notifyTicketSold: z.boolean().optional(),
      notifyMarketing: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      hapticsEnabled: z.boolean().optional(),
    })
    .parse(req.body || {});

  const preferences = await updateOwnerNotificationPreference(ownerId, input);
  res.json({ preferences });
}));

/**
 * POST /api/owner-dashboard/devices/register
 */
router.post('/devices/register', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const input = z
    .object({
      platform: z.string().min(2),
      oneSignalPlayerId: z.string().optional(),
      appVersion: z.string().optional(),
      deviceModel: z.string().optional(),
      osVersion: z.string().optional(),
    })
    .parse(req.body || {});

  const device = await registerOwnerDevice(ownerId, input);
  res.status(201).json({ device });
}));

/**
 * POST /api/owner-dashboard/devices/unregister
 */
router.post('/devices/unregister', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const input = z
    .object({
      oneSignalPlayerId: z.string().optional(),
    })
    .parse(req.body || {});

  await unregisterOwnerDevice(ownerId, input.oneSignalPlayerId);
  res.json({ message: 'Device unregistered' });
}));

/**
 * GET /api/owner-dashboard/notifications
 */
router.get('/notifications', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));

  const [notifications, total, unread] = await Promise.all([
    (prisma as any).ownerNotification.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    (prisma as any).ownerNotification.count({ where: { ownerId } }),
    (prisma as any).ownerNotification.count({ where: { ownerId, isRead: false } }),
  ]);

  res.json({
    notifications,
    unreadCount: unread,
    pagination: {
      page,
      limit,
      total,
    },
  });
}));

/**
 * PATCH /api/owner-dashboard/notifications/:id/read
 */
router.patch('/notifications/:id/read', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const id = req.params.id;

  const notification = await (prisma as any).ownerNotification.findFirst({
    where: { id, ownerId },
  });

  if (!notification) throw new AppError('Notification not found', 404);

  const updated = await (prisma as any).ownerNotification.update({
    where: { id },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  res.json({ notification: updated });
}));

/**
 * GET /api/owner-dashboard/support-content
 */
router.get('/support-content', asyncHandler(async (_req, res) => {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
    select: {
      supportEmail: true,
      supportWhatsAppNumber: true,
      faqContentJson: true,
    },
  });

  let faq: Array<{ question: string; answer: string }> = [];
  if (settings?.faqContentJson) {
    try {
      const parsed = JSON.parse(settings.faqContentJson);
      if (Array.isArray(parsed)) {
        faq = parsed
          .map((item) => ({
            question: String(item?.question || ''),
            answer: String(item?.answer || ''),
          }))
          .filter((item) => item.question && item.answer);
      }
    } catch {
      faq = [];
    }
  }

  res.json({
    supportEmail: settings?.supportEmail || null,
    supportWhatsAppNumber: settings?.supportWhatsAppNumber || null,
    faq,
  });
}));

const resolveLegacyPreferredMethod = (walletType: string) => {
  if (walletType === 'stripe') return 'stripe';
  if (walletType === 'paypal') return 'paypal';
  if (walletType === 'paystack') return 'paystack';
  return 'bank';
};

const buildLegacyWallet = (ownerWallet: any, ownerPayoutWallets: any[]) => {
  const state = resolveOwnerWalletState(ownerPayoutWallets);
  const preferred =
    state.manualWallet ||
    state.verifiedAutomatedWallets[0] ||
    state.automatedWallets[0] ||
    null;
  if (!preferred && !ownerWallet) return null;
  return {
    ...(ownerWallet || {}),
    preferredMethod: preferred
      ? resolveLegacyPreferredMethod(normalizeWalletType(preferred.walletType))
      : ownerWallet?.preferredMethod || 'bank',
    currency: preferred?.currency || ownerWallet?.currency || 'USD',
    isVerified: typeof preferred?.isVerified === 'boolean' ? preferred.isVerified : Boolean(ownerWallet?.isVerified),
    paystackSubaccount: preferred?.paystackSubaccount || ownerWallet?.paystackSubaccount || null,
    paystackRecipientCode: preferred?.paystackRecipientCode || ownerWallet?.paystackRecipientCode || null,
  };
};

/**
 * GET /api/owner-dashboard/wallet
 * Get wallet configuration for the logged-in owner
 */
router.get('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;

  const [owner, gateways, manualTransactions, manualPayouts] = await Promise.all([
    prisma.owner.findUnique({
      where: { id: ownerId },
      include: { wallet: true, wallets: true },
    }),
    prisma.paymentGateway.findMany({
      where: { isActive: true },
      select: {
        gateway: true,
        stripePublicKey: true,
        stripeSecretKey: true,
        paystackPublicKey: true,
        paystackSecretKey: true,
        flutterwavePublicKey: true,
        flutterwaveSecretKey: true,
        customGatewayApiKey: true,
        customGatewayApiSecret: true,
        customGatewayApiUrl: true,
        mtnMomoApiKey: true,
        mtnMomoApiSecret: true,
        mtnMomoSubscriptionKey: true,
        telecelCashApiKey: true,
        telecelCashApiSecret: true,
        telecelCashMerchantId: true,
        airteltigoCashApiKey: true,
        airteltigoCashApiSecret: true,
        airteltigoCashMerchantId: true,
      },
    }),
    prisma.transactionLegacy.aggregate({
      where: {
        event: { ownerId },
        status: 'completed',
        payoutRouting: 'ADMIN_MANUAL',
      },
      _sum: {
        grossAmount: true,
        netAmount: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.payoutRequest.aggregate({
      where: {
        event: { ownerId },
        status: { in: ['PROCESSING', 'FULFILLED'] },
      },
      _sum: {
        requestedAmount: true,
      },
    }),
  ]);

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const walletState = resolveOwnerWalletState(owner.wallets as any[]);
  const paystackWallet = walletState.walletByType.get('paystack');
  const owed = Number(manualTransactions._sum.netAmount || 0);
  const settled = Number(manualPayouts._sum.requestedAmount || 0);
  const outstanding = Math.max(0, owed - settled);

  res.json({
    countryCode: owner.countryCode || null,
    walletMode: walletState.mode,
    availableWalletTypes: getAvailableWalletTypes({
      paymentGateways: gateways as any[],
      countryCode: owner.countryCode,
    }),
    wallets: owner.wallets || [],
    wallet: buildLegacyWallet(owner.wallet, owner.wallets),
    paystackAutomationReady: Boolean(
      paystackWallet?.paystackSubaccount && paystackWallet?.paystackRecipientCode
    ),
    manualSettlement: {
      transactionCount: manualTransactions._count._all || 0,
      amountReceived: Number(manualTransactions._sum.grossAmount || 0),
      amountOwed: owed,
      amountSettled: settled,
      outstandingBalance: outstanding,
    },
  });
}));

/**
 * POST /api/owner-dashboard/wallet
 * Add/update owner payout wallet (manual/offline/automated)
 */
router.post('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true, wallets: true },
  });
  if (!owner) throw new AppError('Owner not found', 404);

  const walletSchema = z.object({
    walletId: z.string().uuid().optional(),
    walletType: z.enum(['manual', 'offline', 'stripe', 'paypal', 'paystack', 'flutterwave']).optional(),
    preferredMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).optional(),
    label: z.string().max(120).optional(),
    currency: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((v) => v.toUpperCase()).optional(),
    countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional(),
    providerAccountId: z.string().optional(),
    paystackSubaccount: z.string().optional(),
    paystackRecipientCode: z.string().optional(),
    paypalEmail: z.string().email().optional(),
    stripeAccountId: z.string().optional(),
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    mobileProvider: z.string().optional(),
    mobileNumber: z.string().optional(),
    detailsJson: z.string().optional(),
    isVerified: z.boolean().optional(),
    isActive: z.boolean().optional(),
  });
  const input = walletSchema.parse(req.body || {});
  const legacyWalletType = input.preferredMethod
    ? (input.preferredMethod === 'paypal' || input.preferredMethod === 'stripe' || input.preferredMethod === 'paystack'
        ? input.preferredMethod
        : 'manual')
    : undefined;
  const walletType = normalizeWalletType(input.walletType || legacyWalletType || '');
  if (!walletType) {
    throw new AppError('walletType or preferredMethod is required', 400);
  }
  const nextCountryCode = input.countryCode || owner.countryCode || 'US';

  const gateways = await prisma.paymentGateway.findMany({
    where: { isActive: true },
    select: {
      gateway: true,
      stripePublicKey: true,
      stripeSecretKey: true,
      paystackPublicKey: true,
      paystackSecretKey: true,
      flutterwavePublicKey: true,
      flutterwaveSecretKey: true,
      customGatewayApiKey: true,
      customGatewayApiSecret: true,
      customGatewayApiUrl: true,
      mtnMomoApiKey: true,
      mtnMomoApiSecret: true,
      mtnMomoSubscriptionKey: true,
      telecelCashApiKey: true,
      telecelCashApiSecret: true,
      telecelCashMerchantId: true,
      airteltigoCashApiKey: true,
      airteltigoCashApiSecret: true,
      airteltigoCashMerchantId: true,
    },
  });
  const availableWalletTypes = getAvailableWalletTypes({
    paymentGateways: gateways as any[],
    countryCode: nextCountryCode,
  });
  if (!isManualWalletType(walletType) && !availableWalletTypes.includes(walletType)) {
    throw new AppError(`Wallet type "${walletType}" is not available in ${nextCountryCode}`, 400);
  }

  const activeWallets = owner.wallets.filter((wallet: any) => wallet.isActive);
  const activeManualWallet = activeWallets.find((wallet: any) => isManualWalletType(wallet.walletType));
  const activeAutomatedWallets = activeWallets.filter((wallet: any) => !isManualWalletType(wallet.walletType));
  const isEditingCurrentManual = Boolean(input.walletId && activeManualWallet?.id === input.walletId);

  if (isManualWalletType(walletType) && activeAutomatedWallets.length > 0) {
    throw new AppError('Manual/offline wallet cannot be enabled while automated wallets are active', 400);
  }
  if (!isManualWalletType(walletType) && activeManualWallet && !isEditingCurrentManual) {
    throw new AppError('Disable manual/offline wallet before adding automated wallets', 400);
  }

  let details: Record<string, any> = {};
  if (input.detailsJson) {
    try {
      details = JSON.parse(input.detailsJson);
    } catch {
      throw new AppError('detailsJson must be valid JSON', 400);
    }
  }
  if (input.paypalEmail) details.paypalEmail = input.paypalEmail;
  if (input.stripeAccountId) details.stripeAccountId = input.stripeAccountId;
  if (input.bankName) details.bankName = input.bankName;
  if (input.accountName) details.accountName = input.accountName;
  if (input.accountNumber) details.accountNumber = input.accountNumber;
  if (input.routingNumber) details.routingNumber = input.routingNumber;
  if (input.swiftCode) details.swiftCode = input.swiftCode;
  if (input.mobileProvider) details.mobileProvider = input.mobileProvider;
  if (input.mobileNumber) details.mobileNumber = input.mobileNumber;

  const defaultCurrency = input.currency || owner.wallet?.currency || 'USD';
  let walletRecord: any;
  if (input.walletId) {
    const existing = await (prisma as any).ownerPayoutWallet.findFirst({
      where: { id: input.walletId, ownerId },
    });
    if (!existing) throw new AppError('Wallet not found', 404);
    walletRecord = await (prisma as any).ownerPayoutWallet.update({
      where: { id: existing.id },
      data: {
        walletType,
        label: input.label ?? undefined,
        currency: defaultCurrency,
        countryCode: nextCountryCode,
        providerAccountId: input.providerAccountId ?? undefined,
        paystackSubaccount: input.paystackSubaccount ?? undefined,
        paystackRecipientCode: input.paystackRecipientCode ?? undefined,
        detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
        isVerified: input.isVerified ?? undefined,
        isActive: input.isActive ?? true,
        verifiedAt: input.isVerified === true ? new Date() : undefined,
      },
    });
  } else if (isManualWalletType(walletType) && activeManualWallet) {
    walletRecord = await (prisma as any).ownerPayoutWallet.update({
      where: { id: activeManualWallet.id },
      data: {
        walletType,
        label: input.label ?? undefined,
        currency: defaultCurrency,
        countryCode: nextCountryCode,
        detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
        isActive: input.isActive ?? true,
      },
    });
  } else {
    walletRecord = await (prisma as any).ownerPayoutWallet.create({
      data: {
        ownerId,
        walletType,
        label: input.label || null,
        currency: defaultCurrency,
        countryCode: nextCountryCode,
        providerAccountId: input.providerAccountId || null,
        paystackSubaccount: input.paystackSubaccount || null,
        paystackRecipientCode: input.paystackRecipientCode || null,
        detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : null,
        isVerified: Boolean(input.isVerified),
        verifiedAt: input.isVerified ? new Date() : null,
        isActive: input.isActive ?? true,
      },
    });
  }

  if (isManualWalletType(walletType)) {
    await (prisma as any).ownerPayoutWallet.updateMany({
      where: {
        ownerId,
        id: { not: walletRecord.id },
        walletType: { in: ['manual', 'offline'] },
      },
      data: { isActive: false },
    });
  }

  const legacyPreferredMethod = resolveLegacyPreferredMethod(walletType);
  await (prisma as any).ownerWallet.upsert({
    where: { ownerId },
    create: {
      ownerId,
      preferredMethod: legacyPreferredMethod,
      currency: walletRecord.currency,
      paystackSubaccount: walletRecord.paystackSubaccount || null,
      paystackRecipientCode: walletRecord.paystackRecipientCode || null,
      isVerified: Boolean(walletRecord.isVerified),
      verifiedAt: walletRecord.isVerified ? new Date() : null,
    },
    update: {
      preferredMethod: legacyPreferredMethod,
      currency: walletRecord.currency,
      paystackSubaccount: walletRecord.paystackSubaccount || null,
      paystackRecipientCode: walletRecord.paystackRecipientCode || null,
      isVerified: Boolean(walletRecord.isVerified),
      verifiedAt: walletRecord.isVerified ? new Date() : null,
    },
  });

  await prisma.owner.update({
    where: { id: ownerId },
    data: { countryCode: nextCountryCode },
  });

  const latestOwner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true, wallets: true },
  });
  const state = resolveOwnerWalletState((latestOwner?.wallets || []) as any[]);
  res.json({
    wallet: buildLegacyWallet(latestOwner?.wallet, latestOwner?.wallets || []),
    wallets: latestOwner?.wallets || [],
    walletMode: state.mode,
    message: 'Wallet saved successfully',
  });
}));

router.delete('/wallet/:walletId', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const walletId = req.params.walletId;
  const wallet = await (prisma as any).ownerPayoutWallet.findFirst({
    where: { id: walletId, ownerId },
  });
  if (!wallet) throw new AppError('Wallet not found', 404);

  await (prisma as any).ownerPayoutWallet.update({
    where: { id: wallet.id },
    data: { isActive: false },
  });

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true, wallets: true },
  });
  const state = resolveOwnerWalletState((owner?.wallets || []) as any[]);
  res.json({
    wallet: buildLegacyWallet(owner?.wallet, owner?.wallets || []),
    wallets: owner?.wallets || [],
    walletMode: state.mode,
    message: 'Wallet removed successfully',
  });
}));

/**
 * GET /api/owner-dashboard/wallet/paystack/banks
 * List banks from Paystack for easy owner setup
 */
/**
 * GET /api/owner-dashboard/wallet/gateways
 * Which gateways can confirm a payout account before it is saved.
 */
router.get('/wallet/gateways', asyncHandler(async (_req, res) => {
  res.json({ gateways: listPayoutAccountGateways() });
}));

/**
 * GET /api/owner-dashboard/wallet/:gateway/banks
 * Destination banks for a gateway, in that gateway's own vocabulary.
 */
router.get('/wallet/:gateway/banks', asyncHandler(async (req, res) => {
  const provider = getPayoutAccountProvider(req.params.gateway);
  const country = String(req.query.country || '').trim().toLowerCase() || undefined;
  const currency = String(req.query.currency || '').trim().toUpperCase() || undefined;

  const banks = await provider.listBanks({ country, currency });
  res.json({
    banks,
    supportsAccountLookup: provider.supportsAccountLookup,
    unsupportedReason: provider.unsupportedReason || null,
  });
}));

/**
 * POST /api/owner-dashboard/wallet/:gateway/resolve-account
 * Confirm who owns a payout account before the owner commits to it. This is
 * a read-only check: nothing is created until the connect call runs.
 */
router.post('/wallet/:gateway/resolve-account', asyncHandler(async (req, res) => {
  const provider = getPayoutAccountProvider(req.params.gateway);
  if (!provider.supportsAccountLookup) {
    throw new AppError(
      provider.unsupportedReason || 'This gateway cannot confirm accounts automatically',
      400
    );
  }

  const schema = z.object({
    accountNumber: z.string().min(4, 'Account number is required'),
    bankCode: z.string().min(1, 'Bank is required'),
    currency: z.string().optional(),
  });
  const input = schema.parse(req.body);

  const account = await provider.resolveAccount({
    accountNumber: input.accountNumber.replace(/\s+/g, ''),
    bankCode: input.bankCode.trim(),
    currency: input.currency,
  });

  res.json({ account });
}));


/**
 * POST /api/owner-dashboard/wallet/paystack/connect
 * Verify bank account and create/update Paystack subaccount for automated split payouts
 */
router.post('/wallet/paystack/connect', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true, wallets: true },
  });

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const connectSchema = z.object({
    bankCode: z.string().min(2, 'Bank code is required'),
    accountNumber: z.string().min(6, 'Account number is required'),
    businessName: z.string().optional(),
    currency: z.string().optional(),
    country: z.string().optional(),
    setAsPreferred: z.boolean().optional(),
    percentageCharge: z.number().min(0).max(100).optional(),
  });

  const input = connectSchema.parse(req.body);
  const ownerCountryCode = (input.country || owner.countryCode || '').trim().toUpperCase();
  if (!ownerCountryCode) {
    throw new AppError('Owner country is required before connecting Paystack', 400);
  }
  const state = resolveOwnerWalletState(owner.wallets as any[]);
  if (state.manualWallet) {
    throw new AppError('Disable manual/offline wallet before connecting Paystack', 400);
  }

  const accountNumber = input.accountNumber.replace(/\s+/g, '');
  const bankCode = input.bankCode.trim();
  const businessName =
    input.businessName?.trim() ||
    owner.company?.trim() ||
    owner.name?.trim() ||
    owner.email;

  const resolvedAccount = await resolvePaystackAccount(accountNumber, bankCode);

  const payload = {
    businessName,
    bankCode,
    accountNumber,
    percentageCharge: input.percentageCharge ?? 0,
    primaryContactName: owner.name,
    primaryContactEmail: owner.email,
    description: `EventPeepo owner payout destination (${owner.id})`,
  };

  const existingPaystackWallet = (owner.wallets || []).find((wallet: any) =>
    wallet.isActive && normalizeWalletType(wallet.walletType) === 'paystack'
  );
  let paystackSubaccount =
    existingPaystackWallet?.paystackSubaccount || owner.wallet?.paystackSubaccount || undefined;
  let paystackRecipientCode =
    existingPaystackWallet?.paystackRecipientCode || (owner.wallet as any)?.paystackRecipientCode || undefined;
  const walletCurrency =
    (input.currency || existingPaystackWallet?.currency || owner.wallet?.currency || 'NGN').toUpperCase();

  if (paystackSubaccount) {
    try {
      const updated = await updatePaystackSubaccount(paystackSubaccount, payload);
      paystackSubaccount = updated.subaccount_code || paystackSubaccount;
    } catch {
      const created = await createPaystackSubaccount(payload);
      paystackSubaccount = created.subaccount_code;
    }
  } else {
    const created = await createPaystackSubaccount(payload);
    paystackSubaccount = created.subaccount_code;
  }

  try {
    const recipient = await createPaystackTransferRecipient({
      name: resolvedAccount.account_name || businessName,
      accountNumber,
      bankCode,
      currency: walletCurrency,
      type: 'nuban',
      description: `EventPeepo owner transfer recipient (${owner.id})`,
    });
    paystackRecipientCode = recipient.recipient_code;
  } catch (error) {
    if (!paystackRecipientCode) {
      throw error;
    }
  }

  const payoutWallet = existingPaystackWallet
    ? await (prisma as any).ownerPayoutWallet.update({
        where: { id: existingPaystackWallet.id },
        data: {
          walletType: 'paystack',
          currency: walletCurrency,
          countryCode: ownerCountryCode,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
          paystackSubaccount,
          paystackRecipientCode,
          detailsJson: JSON.stringify({
            bankCode,
            bankName: resolvedAccount.bank_name || null,
            accountName: resolvedAccount.account_name || null,
            accountNumber: resolvedAccount.account_number || accountNumber,
          }),
        },
      })
    : await (prisma as any).ownerPayoutWallet.create({
        data: {
          ownerId,
          walletType: 'paystack',
          currency: walletCurrency,
          countryCode: ownerCountryCode,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
          paystackSubaccount: paystackSubaccount || null,
          paystackRecipientCode: paystackRecipientCode || null,
          detailsJson: JSON.stringify({
            bankCode,
            bankName: resolvedAccount.bank_name || null,
            accountName: resolvedAccount.account_name || null,
            accountNumber: resolvedAccount.account_number || accountNumber,
          }),
        },
      });

  const wallet = await (prisma as any).ownerWallet.upsert({
    where: { ownerId },
    create: {
      ownerId,
      bankName: resolvedAccount.bank_name || owner.wallet?.bankName || null,
      accountName: resolvedAccount.account_name,
      accountNumber,
      routingNumber: bankCode,
      paystackSubaccount,
      paystackRecipientCode,
      paystackRecipientType: 'nuban',
      paystackRecipientName: resolvedAccount.account_name,
      paystackRecipientBankCode: bankCode,
      paystackRecipientUpdatedAt: new Date(),
      preferredMethod: input.setAsPreferred === false ? (owner.wallet?.preferredMethod || 'bank') : 'paystack',
      currency: walletCurrency,
      isVerified: true,
      verifiedAt: new Date(),
    },
    update: {
      bankName: resolvedAccount.bank_name || owner.wallet?.bankName || undefined,
      accountName: resolvedAccount.account_name,
      accountNumber,
      routingNumber: bankCode,
      paystackSubaccount,
      paystackRecipientCode,
      paystackRecipientType: 'nuban',
      paystackRecipientName: resolvedAccount.account_name,
      paystackRecipientBankCode: bankCode,
      paystackRecipientUpdatedAt: new Date(),
      preferredMethod: input.setAsPreferred === false ? undefined : 'paystack',
      currency: walletCurrency,
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  await prisma.owner.update({
    where: { id: ownerId },
    data: { countryCode: ownerCountryCode },
  });

  await prisma.auditLog.create({
    data: {
      action: 'OWNER_PAYSTACK_CONNECTED',
      entityType: 'OWNER_WALLET',
      entityId: payoutWallet.id,
      details: JSON.stringify({
        ownerId,
        bankCode,
        country: ownerCountryCode,
        currency: payoutWallet.currency,
        paystackSubaccount,
        paystackRecipientCode,
      }),
    },
  });

  const latestOwner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true, wallets: true },
  });

  res.json({
    wallet: buildLegacyWallet(latestOwner?.wallet, latestOwner?.wallets || []),
    payoutWallet,
    paystack: {
      subaccountCode: paystackSubaccount,
      recipientCode: paystackRecipientCode,
      accountName: resolvedAccount.account_name,
      accountNumber: resolvedAccount.account_number,
    },
    message: 'Paystack auto-payout account connected successfully',
  });
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
      const transactions = await prisma.transactionLegacy.findMany({
        where: {
          eventId: event.id,
          type: { in: ['ticket_sale', 'gift_cash'] },
          status: 'completed',
        },
      });
      const payoutEligibleTransactions = transactions.filter((tx) => (
        (tx as any).payoutRouting !== 'OWNER_AUTOMATED'
      ));
      const totalCurrency =
        payoutEligibleTransactions[0]?.currency || transactions[0]?.currency || 'USD';

      // Calculate total net amount (available for payout)
      const totalNet = payoutEligibleTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);

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
        currency: totalCurrency,
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
    currency: z.string().optional(),
    payoutMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).optional(),
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

  if (wallet.preferredMethod === 'paystack' && !wallet.paystackRecipientCode) {
    throw new AppError(
      'Paystack payouts require a connected receiving account. Please reconnect Paystack in Wallet settings.',
      400
    );
  }
  
  // Enforce wallet configuration as source of truth for secure payouts.
  
  // Calculate available balance for this event
  const transactions = await prisma.transactionLegacy.findMany({
    where: {
      eventId: data.eventId,
      type: { in: ['ticket_sale', 'gift_cash'] },
      status: 'completed',
    },
  });

  const payoutEligibleTransactions = transactions.filter((tx) => (
    (tx as any).payoutRouting !== 'OWNER_AUTOMATED'
  ));
  const totalNet = payoutEligibleTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
  
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
      `Requested amount (${wallet.currency} ${data.requestedAmount.toFixed(2)}) exceeds available balance (${wallet.currency} ${availableBalance.toFixed(2)})`,
      400
    );
  }
  
  // Create payout request
  const payout = await (prisma as any).payoutRequest.create({
    data: {
      eventId: data.eventId,
      requestedAmount: data.requestedAmount,
      currency: wallet.currency,
      payoutMethod: wallet.preferredMethod,
      notes: data.notes,
      status: 'PENDING',
      ledgerStatus: 'REQUESTED',
      gateway: wallet.preferredMethod === 'paystack' ? 'paystack' : 'manual',
      requestedByOwnerId: ownerId,
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

  await prisma.auditLog.create({
    data: {
      eventId: data.eventId,
      action: 'OWNER_PAYOUT_REQUEST_CREATED',
      entityType: 'PAYOUT',
      entityId: payout.id,
      details: JSON.stringify({
        ownerId,
        requestedAmount: payout.requestedAmount,
        currency: payout.currency,
        payoutMethod: payout.payoutMethod,
      }),
    },
  });

  let resultPayout = payout;
  let automation = {
    attempted: false,
    initiated: false,
    message: null as string | null,
  };

  if (wallet.preferredMethod === 'paystack') {
    automation.attempted = true;
    try {
      resultPayout = await queuePaystackTransferForPayout(payout.id, null);
      automation.initiated = true;
      automation.message = 'Paystack transfer has been initiated and will reconcile automatically via webhook.';
    } catch (error: any) {
      resultPayout = await (prisma as any).payoutRequest.update({
        where: { id: payout.id },
        data: {
          status: 'DELAYED',
          ledgerStatus: 'MANUAL_REVIEW',
          failureMessage: error?.message || 'Failed to queue transfer',
        },
      });
      automation.initiated = false;
      automation.message = 'Automatic transfer could not be started. This payout is queued for manual review.';
    }
  }
  
  res.status(201).json({ payout: resultPayout, automation });
}));

export default router;
