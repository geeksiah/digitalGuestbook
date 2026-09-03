import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { randomUUID, createHash } from 'crypto';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin, authenticateOwnerAccount } from '../middleware/auth.js';
import { createPaymentIntent, verifyGatewayTransaction } from '../services/paymentCore.js';
import { buildEventPublicUrl, getSiteUrl } from '../utils/siteUrl.js';
import { BUCKETS, buildPublicUrl, uploadToSupabase } from '../services/supabaseStorage.js';
import {
  computeGiftSettlement,
  getGiftFeeDefaults,
  resolveGiftFeeConfig,
  type GiftFeeConfig,
} from '../utils/fees.js';
import {
  connectedAccountIdForWallet,
  filterEventGatewaysForOwner,
  resolveOwnerWalletState,
} from '../utils/walletPolicy.js';

const router = Router();

const giftPackageImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed for gift package photos', 400));
      return;
    }
    cb(null, true);
  },
});

const packageSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  price: z.number().positive(),
  currency: z.string().default('USD'),
  thumbnailPath: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  /** Null clears the limit and makes the package unlimited again. */
  stockQuantity: z.number().int().min(0).optional().nullable(),
});

const checkoutSchema = z.object({
  guestName: z.string().min(2),
  guestPhone: z.string().optional().nullable(),
  guestEmail: z.string().email().optional().nullable(),
  paymentGatewayId: z.string().uuid().optional().nullable(),
  paymentMethod: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  deliveryDate: z.string().datetime().optional().nullable(),
  cashGiftAmount: z.number().min(0).optional().nullable(),
  /** Absolute URL of the gift page the guest is on, used to route them back. */
  returnUrl: z.string().optional().nullable(),
  packageItems: z.array(z.object({
    giftPackageId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  })).optional(),
});

const assignmentSchema = z.object({
  packageIds: z.array(z.string().uuid()).default([]),
});

/**
 * Remaining stock for a package. Null stock means unlimited, so it reports
 * null rather than a number and never blocks a purchase.
 */
const remainingStock = (pkg: { stockQuantity?: number | null; soldQuantity?: number | null }) => {
  if (pkg.stockQuantity === null || pkg.stockQuantity === undefined) return null;
  return Math.max(0, pkg.stockQuantity - Number(pkg.soldQuantity || 0));
};

type EventDomainRow = { host: string; status: string; isPrimary: boolean };

/**
 * Where the gateway should send the payer back to. The guest may be on the
 * platform host or on the event's own domain, so the page tells us where it
 * is and we accept it only if that host really belongs to this event. Anything
 * else falls back to the canonical gift URL rather than trusting the input.
 */
const resolveGiftReturnUrl = (params: {
  requested?: string | null;
  slug: string;
  domains: EventDomainRow[];
}) => {
  const canonical = `${buildEventPublicUrl(params.slug, '/gift', params.domains)}/status`;

  const requested = String(params.requested || '').trim();
  if (!requested) return canonical;

  let parsed: URL;
  try {
    parsed = new URL(requested);
  } catch {
    return canonical;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return canonical;

  const allowedHosts = new Set<string>();
  try {
    allowedHosts.add(new URL(getSiteUrl()).host.toLowerCase());
  } catch {
    /* getSiteUrl already falls back to a safe default */
  }
  for (const domain of params.domains || []) {
    if (domain.status === 'ACTIVE' || domain.status === 'VERIFIED') {
      allowedHosts.add(String(domain.host || '').toLowerCase());
      allowedHosts.add(`www.${String(domain.host || '').toLowerCase()}`);
    }
  }

  return allowedHosts.has(parsed.host.toLowerCase()) ? parsed.toString() : canonical;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

/**
 * Orders written since gift settlement was introduced carry their own frozen
 * figures, so changing fee settings never restates history. Older orders have
 * no stored settlement, so they are recomputed from the fee config once, as a
 * best-effort reconstruction.
 */
const enrichGiftOrder = (order: any, feeDefaults: GiftFeeConfig) => {
  const packageAmount = order.items
    .filter((item: any) => item.type === 'PACKAGE')
    .reduce((sum: number, item: any) => sum + item.lineTotal, 0);
  const cashGiftAmount = Number(order.cashGiftAmount || 0);
  const feeConfig = resolveGiftFeeConfig(order.event, feeDefaults);

  const hasStoredSettlement =
    Number(order.ownerNetAmount || 0) > 0 ||
    Number(order.platformFeeAmount || 0) > 0 ||
    Number(order.processingFeeAmount || 0) > 0;

  const settlement = hasStoredSettlement
    ? {
        packageAmount: Number(order.packageAmount || packageAmount),
        cashGiftAmount,
        platformFeeAmount: Number(order.platformFeeAmount || 0),
        processingFeeAmount: Number(order.processingFeeAmount || 0),
        ownerNetAmount: Number(order.ownerNetAmount || 0),
      }
    : computeGiftSettlement({ packageAmount, cashGiftAmount, config: feeConfig });

  return {
    ...order,
    platformFeeMode: feeConfig.platformFeeMode,
    platformFeePercent: feeConfig.platformFeePercent,
    platformFeeFixed: feeConfig.platformFeeFixed,
    giftItemFee: feeConfig.giftItem,
    cashGiftFee: feeConfig.cashGift,
    packageAmount: settlement.packageAmount,
    platformFeeAmount: settlement.platformFeeAmount,
    processingFeeAmount: settlement.processingFeeAmount,
    ownerNetAmount: settlement.ownerNetAmount,
    // What the platform keeps: gift items in full, plus the fee taken from
    // the cash gift, less the processor cost.
    adminRetainedAmount: roundMoney(
      Math.max(
        0,
        settlement.packageAmount +
          cashGiftAmount -
          settlement.ownerNetAmount -
          settlement.processingFeeAmount
      )
    ),
    settlementFrozen: hasStoredSettlement,
  };
};
// ============================================
// Public gifting APIs
// ============================================

router.get('/public/:slug/options', asyncHandler(async (req, res) => {
  const { slug } = req.params;

  const event = await (prisma as any).event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      giftingEnabled: true,
      giftItemsEnabled: true,
      cashGiftsEnabled: true,
      coverImagePath: true,
      coverImageAlt: true,
      socialTitle: true,
      socialDescription: true,
      ownerId: true,
      domains: { select: { host: true, status: true, isPrimary: true } },
    },
  });

  if (!event) throw new AppError('Event not found', 404);
  if (!event.giftingEnabled) throw new AppError('Gifting is disabled for this event', 404);

  const eventPackageLinks = await (prisma as any).eventGiftPackage.findMany({
    where: { eventId: event.id },
    select: { giftPackageId: true },
  });
  const assignedPackageIds = eventPackageLinks.map((link: { giftPackageId: string }) => link.giftPackageId);

  const packages = event.giftItemsEnabled
    ? await prisma.giftPackage.findMany({
        where: {
          isActive: true,
          ...(assignedPackageIds.length ? { id: { in: assignedPackageIds } } : {}),
        },
        orderBy: [{ price: 'asc' }, { createdAt: 'desc' }],
      })
    : [];
  const { ownerId, domains: eventDomains, ...eventPublic } = event;
  // Where "Back to event" should go: the custom domain when one is live.
  const eventUrl = buildEventPublicUrl(event.slug, '', eventDomains || []);

  const eventGateways = await prisma.eventPaymentGateway.findMany({
    where: {
      eventId: event.id,
      isActive: true,
      paymentGateway: {
        isActive: true,
      },
    },
    include: {
      paymentGateway: {
        select: {
          id: true,
          name: true,
          gateway: true,
          currency: true,
          paystackPublicKey: true,
          stripePublicKey: true,
          flutterwavePublicKey: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const ownerProfile = event.ownerId
    ? await prisma.owner.findUnique({
        where: { id: event.ownerId },
        select: {
          countryCode: true,
          wallets: {
            where: { isActive: true },
            select: {
              id: true,
              walletType: true,
              isActive: true,
              isVerified: true,
              currency: true,
              providerAccountId: true,
              paystackSubaccount: true,
              paystackRecipientCode: true,
            },
          },
        },
      })
    : null;
  const walletState = resolveOwnerWalletState((ownerProfile?.wallets || []) as any[]);
  const visibleGateways = filterEventGatewaysForOwner({
    eventGateways: eventGateways as any[],
    walletState,
  });
  const paystackWallet = walletState.walletByType.get('paystack');

  res.json({
    event: eventPublic,
    eventUrl,
    packages: packages.map((pkg) => {
      const remaining = remainingStock(pkg);
      return {
        ...pkg,
        thumbnailUrl: pkg.thumbnailPath ? buildPublicUrl(BUCKETS.MEDIA, pkg.thumbnailPath) : null,
        remainingStock: remaining,
        inStock: remaining === null || remaining > 0,
      };
    }),
    momoEnabled: true,
    walletMode: walletState.mode,
    settlementPolicy: {
      cashGift: walletState.mode === 'AUTOMATED' ? 'owner_wallet_routing' : 'platform_settlement',
      packagePurchase: 'platform_only',
      // The gateway split is computed from the cash portion alone, so items
      // and a cash gift can safely share one checkout.
      mixedPaystackCheckoutAllowed: true,
    },
    paymentGateways: visibleGateways.map((eventGateway) => {
      const gateway = eventGateway.paymentGateway;
      const publicKey =
        gateway.gateway === 'paystack'
          ? gateway.paystackPublicKey
          : gateway.gateway === 'stripe'
          ? gateway.stripePublicKey
          : gateway.gateway === 'flutterwave'
          ? gateway.flutterwavePublicKey
          : null;
      return {
        id: gateway.id,
        name: gateway.name,
        gateway: gateway.gateway,
        currency: gateway.currency,
        publicKey,
        splitConfig:
          gateway.gateway === 'paystack' && paystackWallet?.paystackSubaccount
            ? {
                subaccount: paystackWallet.paystackSubaccount,
                bearer: 'subaccount',
                ownerWalletVerified: Boolean(paystackWallet.isVerified),
              }
            : null,
      };
    }),
  });
}));

router.post('/public/:slug/checkout', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const data = checkoutSchema.parse(req.body);
  const packageItems = data.packageItems || [];
  const cashGiftAmount = data.cashGiftAmount || 0;

  if (!packageItems.length && cashGiftAmount <= 0) {
    throw new AppError('Please select a cash gift amount and/or at least one package', 400);
  }

  const event = await (prisma as any).event.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      giftingEnabled: true,
      giftItemsEnabled: true,
      cashGiftsEnabled: true,
      ownerId: true,
      feeOverridesEnabled: true,
      platformFeeMode: true,
      platformFeePercent: true,
      platformFeeFixed: true,
      processingFeePercent: true,
      processingFeeFixed: true,
      giftItemFeeMode: true,
      giftItemFeePercent: true,
      giftItemFeeFixed: true,
      cashGiftFeeMode: true,
      cashGiftFeePercent: true,
      cashGiftFeeFixed: true,
      slug: true,
      domains: { select: { host: true, status: true, isPrimary: true } },
      Owner: {
        select: {
          countryCode: true,
          wallets: {
            where: { isActive: true },
            select: {
              id: true,
              walletType: true,
              isActive: true,
              isVerified: true,
              currency: true,
              providerAccountId: true,
              paystackSubaccount: true,
              paystackRecipientCode: true,
            },
          },
        },
      },
    },
  });
  if (!event) throw new AppError('Event not found', 404);
  if (!event.giftingEnabled) throw new AppError('Gifting is disabled for this event', 404);

  // The page hides the kind it cannot take, but the rule belongs here too:
  // a stale tab or a direct API call must not slip past it.
  if (packageItems.length && !event.giftItemsEnabled) {
    throw new AppError('This event is not accepting gift items', 400);
  }
  if (cashGiftAmount > 0 && !event.cashGiftsEnabled) {
    throw new AppError('This event is not accepting cash gifts', 400);
  }

  const configuredGateways = await prisma.eventPaymentGateway.findMany({
    where: {
      eventId: event.id,
      isActive: true,
      paymentGateway: { isActive: true },
    },
    select: {
      paymentGatewayId: true,
      paymentGateway: {
        select: {
          id: true,
          gateway: true,
          currency: true,
          name: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const eventPackageLinks = await (prisma as any).eventGiftPackage.findMany({
    where: { eventId: event.id },
    select: { giftPackageId: true },
  });
  const assignedPackageIds = eventPackageLinks.map((link: { giftPackageId: string }) => link.giftPackageId);

  const giftPackages = packageItems.length
    ? await prisma.giftPackage.findMany({
        where: {
          id: {
            in: packageItems
              .map((item) => item.giftPackageId)
              .filter((id) => !assignedPackageIds.length || assignedPackageIds.includes(id)),
          },
          isActive: true,
        },
      })
    : [];

  let packagesTotal = 0;
  const normalizedPackageItems = packageItems.map((item) => {
    const pkg = giftPackages.find((p) => p.id === item.giftPackageId);
    if (!pkg) throw new AppError('One or more gift packages are unavailable', 400);
    // Checked here for a clear message; fulfilment re-checks atomically,
    // because two guests can pass this point at the same moment.
    const remaining = remainingStock(pkg);
    if (remaining !== null && item.quantity > remaining) {
      throw new AppError(
        remaining === 0
          ? `${pkg.name} is out of stock`
          : `Only ${remaining} of ${pkg.name} left`,
        400
      );
    }
    const lineTotal = pkg.price * item.quantity;
    packagesTotal += lineTotal;
    return {
      giftPackageId: pkg.id,
      quantity: item.quantity,
      unitPrice: pkg.price,
      currency: pkg.currency,
    };
  });

  const requestedGatewayId = data.paymentGatewayId || null;
  const requestedPaymentMethod = (data.paymentMethod || '').trim().toLowerCase() || null;
  const ownerWalletState = resolveOwnerWalletState((event.Owner?.wallets || []) as any[]);
  const visibleGateways = filterEventGatewaysForOwner({
    eventGateways: configuredGateways as any[],
    walletState: ownerWalletState,
  });

  if (!visibleGateways.length) {
    throw new AppError('No payment gateway is enabled for this event', 400);
  }

  const selectedGateway = requestedGatewayId
    ? visibleGateways.find((gateway) => gateway.paymentGatewayId === requestedGatewayId)
    : requestedPaymentMethod
    ? visibleGateways.find((gateway) => gateway.paymentGateway.gateway === requestedPaymentMethod)
    : visibleGateways[0];

  if (!selectedGateway) {
    throw new AppError('Selected payment gateway is not enabled for this event', 400);
  }
  if (
    selectedGateway &&
    requestedPaymentMethod &&
    selectedGateway.paymentGateway.gateway !== requestedPaymentMethod
  ) {
    throw new AppError('Payment method does not match selected gateway', 400);
  }
  const totalAmount = packagesTotal + cashGiftAmount;
  const currency = giftPackages[0]?.currency || selectedGateway?.paymentGateway.currency || 'USD';

  if (
    selectedGateway &&
    selectedGateway.paymentGateway.currency &&
    selectedGateway.paymentGateway.currency.toUpperCase() !== currency.toUpperCase()
  ) {
    throw new AppError(
      `Selected gateway currency (${selectedGateway.paymentGateway.currency.toUpperCase()}) does not match order currency (${currency.toUpperCase()})`,
      400
    );
  }

  const idempotencySeed = JSON.stringify({
    eventId: event.id,
    gatewayId: selectedGateway.paymentGatewayId,
    guestName: data.guestName.trim().toLowerCase(),
    guestPhone: String(data.guestPhone || '').trim(),
    packageItems: normalizedPackageItems.map((item) => ({
      id: item.giftPackageId,
      qty: item.quantity,
    })),
    cashGiftAmount: Number(cashGiftAmount.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
  });
  const idempotencyKey =
    String(req.get('Idempotency-Key') || '').trim() ||
    createHash('sha256').update(idempotencySeed).digest('hex');

  // Cash gifts settle to the owner when they have a verified account on the
  // gateway being paid with. Everything else settles to the platform.
  const selectedGatewayType = String(selectedGateway.paymentGateway.gateway || '').toLowerCase();
  const ownerWallet = ownerWalletState.walletByType.get(selectedGatewayType) || null;
  const ownerConnectedAccountId = connectedAccountIdForWallet(ownerWallet as any, selectedGatewayType);

  const { intent, nextAction } = await createPaymentIntent({
    eventId: event.id,
    purpose: 'GIFT',
    amount: totalAmount,
    currency,
    paymentGatewayId: selectedGateway.paymentGatewayId,
    giftBreakdown: { packageAmount: packagesTotal, cashGiftAmount },
    ownerConnectedAccount:
      cashGiftAmount > 0 && ownerConnectedAccountId
        ? { gateway: selectedGatewayType, accountId: ownerConnectedAccountId }
        : null,
    metadata: {
      guestName: data.guestName.trim(),
      guestPhone: data.guestPhone?.trim() || undefined,
      guestEmail: data.guestEmail?.trim() || undefined,
      note: data.note?.trim() || undefined,
      deliveryDate: data.deliveryDate || undefined,
      cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : undefined,
      packageItems: normalizedPackageItems.map((item) => ({
        giftPackageId: item.giftPackageId,
        quantity: item.quantity,
      })),
      callbackUrl: resolveGiftReturnUrl({
        requested: data.returnUrl,
        slug: event.slug,
        domains: (event.domains || []) as EventDomainRow[],
      }),
      ownerWalletId: ownerConnectedAccountId ? ownerWallet?.id : undefined,
      routedWalletType: ownerConnectedAccountId ? selectedGatewayType : undefined,
    },
    idempotencyKey,
  });

  res.status(201).json({
    success: true,
    paymentIntentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    nextAction,
    breakdown: {
      totalAmount,
      packageAmount: packagesTotal,
      cashGiftAmount,
      settlementPolicy: {
        cashGift:
          cashGiftAmount <= 0
            ? 'none'
            : ownerConnectedAccountId
            ? 'owner_split'
            : 'platform_settlement',
        packagePurchase: packagesTotal > 0 ? 'platform_only' : 'none',
      },
    },
    message: 'Gift checkout initialized. Complete payment to confirm.',
  });
}));

/**
 * GET /api/gifting/public/:slug/order-status?reference=...
 *
 * Backs the page a guest lands on after paying. The gateway redirect usually
 * beats its own webhook, so this verifies the reference directly rather than
 * telling the guest their gift failed while the webhook is still in flight.
 * Verification is idempotent: fulfilment already refuses to write an order
 * twice for the same intent.
 */
router.get('/public/:slug/order-status', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const reference = String(req.query.reference || '').trim();

  const event = await (prisma as any).event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      giftingEnabled: true,
      domains: { select: { host: true, status: true, isPrimary: true } },
    },
  });
  if (!event) throw new AppError('Event not found', 404);

  const eventUrl = buildEventPublicUrl(event.slug, '', event.domains || []);
  const giftUrl = buildEventPublicUrl(event.slug, '/gift', event.domains || []);
  const baseResponse = {
    event: { name: event.name, slug: event.slug },
    eventUrl,
    giftUrl,
  };

  if (!reference) {
    return res.json({ ...baseResponse, status: 'UNKNOWN', order: null });
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      eventId: event.id,
      purpose: 'GIFT',
      OR: [
        { gatewayReference: reference },
        { id: reference.replace(/^pi_/, '') },
      ],
    },
  });

  if (!intent) {
    return res.json({ ...baseResponse, status: 'UNKNOWN', order: null });
  }

  // Ask the gateway only while the outcome is still open. Once an intent has
  // settled either way, the stored status is the answer.
  if (intent.status !== 'SUCCEEDED' && intent.status !== 'FAILED') {
    try {
      await verifyGatewayTransaction(intent.id, reference);
    } catch (error) {
      // A gateway that cannot be reached must not turn into a false failure;
      // the webhook is still the source of truth and will land shortly.
      console.warn('[Gift status] verification failed', {
        intentId: intent.id,
        error: (error as Error)?.message,
      });
    }
  }

  const settled = await prisma.paymentIntent.findUnique({ where: { id: intent.id } });
  const order = await (prisma as any).giftOrder.findFirst({
    where: { paymentIntentId: intent.id },
    select: {
      id: true,
      guestName: true,
      currency: true,
      totalAmount: true,
      cashGiftAmount: true,
      packageAmount: true,
      createdAt: true,
      items: {
        select: {
          type: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          giftPackage: { select: { name: true } },
        },
      },
    },
  });

  const status =
    order || settled?.status === 'SUCCEEDED'
      ? 'SUCCEEDED'
      : settled?.status === 'FAILED' || settled?.status === 'EXPIRED'
      ? 'FAILED'
      : 'PENDING';

  res.json({
    ...baseResponse,
    status,
    reference: settled?.gatewayReference || reference,
    order: order
      ? {
          id: order.id,
          guestName: order.guestName,
          currency: order.currency,
          totalAmount: order.totalAmount,
          cashGiftAmount: order.cashGiftAmount,
          packageAmount: order.packageAmount,
          createdAt: order.createdAt,
          items: (order.items || []).map((item: any) => ({
            type: item.type,
            name: item.giftPackage?.name || 'Cash gift',
            quantity: item.quantity,
            lineTotal: item.lineTotal,
          })),
        }
      : null,
  });
}));

// ============================================
// Admin package management
// ============================================

router.get('/packages', authenticateAdmin, asyncHandler(async (_req, res) => {
  const packages = await prisma.giftPackage.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({
    packages: packages.map((pkg) => ({
      ...pkg,
      thumbnailUrl: pkg.thumbnailPath ? buildPublicUrl(BUCKETS.MEDIA, pkg.thumbnailPath) : null,
      remainingStock: remainingStock(pkg),
    })),
  });
}));

router.post('/packages/upload-image', authenticateAdmin, giftPackageImageUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('Package photo is required', 400);
  }

  const extByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
  };
  const extension = extByMime[req.file.mimetype] || 'jpg';
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const storagePath = `gift-packages/${now.getUTCFullYear()}/${month}/${randomUUID()}.${extension}`;

  const upload = await uploadToSupabase(BUCKETS.MEDIA, storagePath, req.file.buffer, {
    contentType: req.file.mimetype,
    metadata: {
      purpose: 'gift-package-thumbnail',
    },
  });

  res.status(201).json({
    thumbnailPath: upload.path,
    thumbnailUrl: upload.publicUrl,
  });
}));

router.post('/packages', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = packageSchema.parse(req.body);
  const giftPackage = await prisma.giftPackage.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      currency: data.currency,
      thumbnailPath: data.thumbnailPath ?? null,
      isActive: data.isActive ?? true,
      stockQuantity: data.stockQuantity ?? null,
    },
  });
  res.status(201).json({ package: giftPackage });
}));

router.patch('/packages/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = packageSchema.partial().parse(req.body);
  const giftPackage = await prisma.giftPackage.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      description: data.description !== undefined ? data.description : undefined,
      price: data.price,
      currency: data.currency,
      thumbnailPath: data.thumbnailPath !== undefined ? data.thumbnailPath : undefined,
      isActive: data.isActive,
      stockQuantity: data.stockQuantity !== undefined ? data.stockQuantity : undefined,
    },
  });
  res.json({ package: giftPackage });
}));

router.delete('/packages/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  await prisma.giftPackage.delete({ where: { id: req.params.id } });
  res.json({ message: 'Package deleted' });
}));

router.get('/events/:eventId/packages', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, giftingEnabled: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const [packages, assigned] = await Promise.all([
    prisma.giftPackage.findMany({
      orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { createdAt: 'desc' }],
    }),
    (prisma as any).eventGiftPackage.findMany({
      where: { eventId },
      select: { giftPackageId: true },
    }),
  ]);

  const assignedSet = new Set(
    assigned.map((row: { giftPackageId: string }) => row.giftPackageId)
  );

  res.json({
    event,
    assignedPackageIds: Array.from(assignedSet),
    packages: packages.map((pkg) => ({
      ...pkg,
      thumbnailUrl: pkg.thumbnailPath ? buildPublicUrl(BUCKETS.MEDIA, pkg.thumbnailPath) : null,
      remainingStock: remainingStock(pkg),
      assigned: assignedSet.has(pkg.id),
    })),
  });
}));

router.put('/events/:eventId/packages', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { packageIds } = assignmentSchema.parse(req.body);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);

  const uniquePackageIds = Array.from(new Set(packageIds));
  if (uniquePackageIds.length) {
    const valid = await prisma.giftPackage.count({
      where: { id: { in: uniquePackageIds } },
    });
    if (valid !== uniquePackageIds.length) {
      throw new AppError('One or more packages are invalid', 400);
    }
  }

  await prisma.$transaction(async (tx) => {
    await (tx as any).eventGiftPackage.deleteMany({ where: { eventId } });
    if (uniquePackageIds.length) {
      await (tx as any).eventGiftPackage.createMany({
        data: uniquePackageIds.map((giftPackageId) => ({ eventId, giftPackageId })),
      });
    }
    await tx.auditLog.create({
      data: {
        eventId,
        action: 'GIFT_PACKAGES_ASSIGNED',
        entityType: 'EVENT',
        entityId: eventId,
        details: JSON.stringify({ packageIds: uniquePackageIds }),
      },
    });
  });

  res.json({
    message: 'Gift packages updated',
    packageIds: uniquePackageIds,
  });
}));

// ============================================
// Admin/Owner order listing
// ============================================

router.get('/orders', authenticateAdmin, asyncHandler(async (req, res) => {
  const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
  const where = eventId ? { eventId } : {};
  const feeDefaults = await getGiftFeeDefaults();
  const orders = await (prisma as any).giftOrder.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          feeOverridesEnabled: true,
          platformFeeMode: true,
          platformFeePercent: true,
          platformFeeFixed: true,
          processingFeePercent: true,
          processingFeeFixed: true,
          giftItemFeeMode: true,
          giftItemFeePercent: true,
          giftItemFeeFixed: true,
          cashGiftFeeMode: true,
          cashGiftFeePercent: true,
          cashGiftFeeFixed: true,
        },
      },
      items: { include: { giftPackage: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const enrichedOrders = orders.map((order: any) => enrichGiftOrder(order, feeDefaults));
  res.json({ orders: enrichedOrders });
}));

router.get('/owner/orders', authenticateOwnerAccount, asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId as string;
  const feeDefaults = await getGiftFeeDefaults();
  const orders = await (prisma as any).giftOrder.findMany({
    where: {
      event: { ownerId },
    },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          feeOverridesEnabled: true,
          platformFeeMode: true,
          platformFeePercent: true,
          platformFeeFixed: true,
          processingFeePercent: true,
          processingFeeFixed: true,
          giftItemFeeMode: true,
          giftItemFeePercent: true,
          giftItemFeeFixed: true,
          cashGiftFeeMode: true,
          cashGiftFeePercent: true,
          cashGiftFeeFixed: true,
        },
      },
      items: { include: { giftPackage: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const enrichedOrders = orders.map((order: any) => enrichGiftOrder(order, feeDefaults));
  res.json({ orders: enrichedOrders });
}));

export default router;
