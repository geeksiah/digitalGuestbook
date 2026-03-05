import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdminOrOwnerAccount, authenticateAdmin } from '../middleware/auth.js';
import prisma from '../utils/prisma.js';
import { PrismaVotingRepository } from '../modules/voting/core/PrismaVotingRepository.js';
import { VotingService } from '../modules/voting/core/VotingService.js';
import { UssdCreditsService } from '../modules/voting/credits/UssdCreditsService.js';
import { VoterIdentityService } from '../modules/voting/core/VoterIdentityService.js';
import { FrogUssdV2Adapter } from '../modules/voting/channels/FrogUssdV2Adapter.js';

const router = Router();

const votingService = new VotingService(new PrismaVotingRepository(prisma));
const creditsService = new UssdCreditsService();
const frogAdapter = new FrogUssdV2Adapter(votingService, creditsService, new VoterIdentityService());

const callbackSchema = z.object({
  network: z.string().min(1),
  sessionid: z.string().min(1),
  mode: z.string().min(1),
  userdata: z.string(),
  username: z.string().min(1),
  trafficid: z.string().min(1),
  other: z.string().optional(),
  msisdn: z.string().optional(),
  phonenumber: z.string().optional(),
});

router.post(
  '/frog/v2',
  asyncHandler(async (req, res) => {
    const allowlist = String(process.env.WIGAL_IP_ALLOWLIST || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (allowlist.length > 0) {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const remoteIp = forwarded || req.ip || req.socket.remoteAddress || '';
      if (remoteIp && !allowlist.includes(remoteIp)) {
        throw new AppError('USSD callback source is not allowed', 403);
      }
    }

    const payload = callbackSchema.parse(req.body || {});
    const response = await frogAdapter.handleRequest(payload);
    res.json(response);
  })
);

router.get(
  '/channels',
  authenticateAdminOrOwnerAccount,
  asyncHandler(async (req: any, res) => {
    const ownerId = String(req.ownerId || '').trim() || undefined;
    const channels = await prisma.ussdChannel.findMany({
      where: ownerId ? { OR: [{ ownerId }, { ownerId: null }] } : {},
      include: {
        bindings: {
          where: { isActive: true },
          select: {
            id: true,
            eventId: true,
            ownerId: true,
            isActive: true,
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ channels });
  })
);

const createChannelSchema = z.object({
  codeLabel: z.string().min(1).max(120),
  shortcode: z.string().max(50).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

router.post(
  '/channels',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const input = createChannelSchema.parse(req.body || {});
    const channel = await prisma.ussdChannel.create({
      data: {
        provider: 'WIGAL_FROG',
        codeLabel: input.codeLabel.trim(),
        shortcode: input.shortcode || null,
        ownerId: input.ownerId || null,
        status: input.status || 'ACTIVE',
      },
    });
    res.status(201).json({ channel });
  })
);

const bindChannelSchema = z.object({
  ussdChannelId: z.string().uuid(),
  eventId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

router.post(
  '/bindings',
  authenticateAdminOrOwnerAccount,
  asyncHandler(async (req: any, res) => {
    const input = bindChannelSchema.parse(req.body || {});
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;

    const event = adminId
      ? await prisma.event.findUnique({
          where: { id: input.eventId },
          select: { id: true, ownerId: true, defaultCurrency: true },
        })
      : await prisma.event.findFirst({
          where: { id: input.eventId, ownerId: ownerId || undefined },
          select: { id: true, ownerId: true, defaultCurrency: true },
        });
    if (!event) throw new AppError('Event not found', 404);

    const channel = await prisma.ussdChannel.findUnique({
      where: { id: input.ussdChannelId },
      select: { id: true, ownerId: true, status: true },
    });
    if (!channel) throw new AppError('USSD channel not found', 404);
    if (!adminId && channel.ownerId && channel.ownerId !== ownerId) {
      throw new AppError('Not authorized to bind this USSD channel', 403);
    }

    const binding = await prisma.ussdChannelBinding.upsert({
      where: {
        ussdChannelId_eventId: {
          ussdChannelId: channel.id,
          eventId: event.id,
        },
      },
      create: {
        ussdChannelId: channel.id,
        ownerId: event.ownerId || ownerId,
        eventId: event.id,
        isActive: input.isActive ?? true,
      },
      update: {
        ownerId: event.ownerId || ownerId,
        isActive: input.isActive ?? true,
      },
      include: {
        ussdChannel: true,
        event: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    await creditsService.ensureWalletForEvent(event.id);
    res.status(201).json({ binding });
  })
);

const toggleBindingSchema = z.object({
  isActive: z.boolean(),
});

router.patch(
  '/bindings/:bindingId',
  authenticateAdminOrOwnerAccount,
  asyncHandler(async (req: any, res) => {
    const { bindingId } = req.params;
    const { isActive } = toggleBindingSchema.parse(req.body || {});
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;

    const binding = await prisma.ussdChannelBinding.findUnique({
      where: { id: bindingId },
      include: {
        event: {
          select: { ownerId: true },
        },
      },
    });
    if (!binding) throw new AppError('Binding not found', 404);
    if (!adminId && binding.event.ownerId !== ownerId) {
      throw new AppError('Not authorized', 403);
    }

    const updated = await prisma.ussdChannelBinding.update({
      where: { id: binding.id },
      data: { isActive },
    });
    res.json({ binding: updated });
  })
);

router.get(
  '/wallets/:eventId',
  authenticateAdminOrOwnerAccount,
  asyncHandler(async (req: any, res) => {
    const { eventId } = req.params;
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;

    const event = adminId
      ? await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
      : await prisma.event.findFirst({
          where: { id: eventId, ownerId: ownerId || undefined },
          select: { id: true, ownerId: true },
        });
    if (!event) throw new AppError('Event not found', 404);

    const wallet = await creditsService.ensureWalletForEvent(event.id);
    const ledger = await prisma.ussdCreditLedgerEntry.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ wallet, ledger });
  })
);

const manualTopupSchema = z.object({
  units: z.number().int().min(1),
  reference: z.string().min(1).max(120),
  note: z.string().max(300).optional().nullable(),
});

router.post(
  '/wallets/:eventId/topups/manual',
  authenticateAdminOrOwnerAccount,
  asyncHandler(async (req: any, res) => {
    const { eventId } = req.params;
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;
    const input = manualTopupSchema.parse(req.body || {});

    const event = adminId
      ? await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
      : await prisma.event.findFirst({
          where: { id: eventId, ownerId: ownerId || undefined },
          select: { id: true, ownerId: true },
        });
    if (!event) throw new AppError('Event not found', 404);

    const wallet = await creditsService.ensureWalletForEvent(event.id);
    const result = await creditsService.topupCredits({
      walletId: wallet.id,
      units: input.units,
      reference: input.reference,
      metadata: {
        source: 'MANUAL',
        note: input.note || null,
      },
    });
    res.status(201).json({
      success: true,
      idempotent: result.idempotent,
      wallet: result.wallet,
    });
  })
);

export default router;
