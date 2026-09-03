"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const multer_1 = __importDefault(require("multer"));
const crypto_1 = require("crypto");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const paymentCore_js_1 = require("../services/paymentCore.js");
const siteUrl_js_1 = require("../utils/siteUrl.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const fees_js_1 = require("../utils/fees.js");
const walletPolicy_js_1 = require("../utils/walletPolicy.js");
const router = (0, express_1.Router)();
const giftPackageImageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new errorHandler_js_1.AppError('Only image files are allowed for gift package photos', 400));
            return;
        }
        cb(null, true);
    },
});
const packageSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional().nullable(),
    price: zod_1.z.number().positive(),
    currency: zod_1.z.string().default('USD'),
    thumbnailPath: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
    /** Null clears the limit and makes the package unlimited again. */
    stockQuantity: zod_1.z.number().int().min(0).optional().nullable(),
});
const checkoutSchema = zod_1.z.object({
    guestName: zod_1.z.string().min(2),
    guestPhone: zod_1.z.string().optional().nullable(),
    guestEmail: zod_1.z.string().email().optional().nullable(),
    paymentGatewayId: zod_1.z.string().uuid().optional().nullable(),
    paymentMethod: zod_1.z.string().optional().nullable(),
    note: zod_1.z.string().optional().nullable(),
    deliveryDate: zod_1.z.string().datetime().optional().nullable(),
    cashGiftAmount: zod_1.z.number().min(0).optional().nullable(),
    /** Absolute URL of the gift page the guest is on, used to route them back. */
    returnUrl: zod_1.z.string().optional().nullable(),
    packageItems: zod_1.z.array(zod_1.z.object({
        giftPackageId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).default(1),
    })).optional(),
});
const assignmentSchema = zod_1.z.object({
    packageIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
/**
 * Remaining stock for a package. Null stock means unlimited, so it reports
 * null rather than a number and never blocks a purchase.
 */
const remainingStock = (pkg) => {
    if (pkg.stockQuantity === null || pkg.stockQuantity === undefined)
        return null;
    return Math.max(0, pkg.stockQuantity - Number(pkg.soldQuantity || 0));
};
/**
 * Where the gateway should send the payer back to. The guest may be on the
 * platform host or on the event's own domain, so the page tells us where it
 * is and we accept it only if that host really belongs to this event. Anything
 * else falls back to the canonical gift URL rather than trusting the input.
 */
const resolveGiftReturnUrl = (params) => {
    const canonical = `${(0, siteUrl_js_1.buildEventPublicUrl)(params.slug, '/gift', params.domains)}/status`;
    const requested = String(params.requested || '').trim();
    if (!requested)
        return canonical;
    let parsed;
    try {
        parsed = new URL(requested);
    }
    catch {
        return canonical;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
        return canonical;
    const allowedHosts = new Set();
    try {
        allowedHosts.add(new URL((0, siteUrl_js_1.getSiteUrl)()).host.toLowerCase());
    }
    catch {
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
const roundMoney = (value) => Math.round(value * 100) / 100;
/**
 * Orders written since gift settlement was introduced carry their own frozen
 * figures, so changing fee settings never restates history. Older orders have
 * no stored settlement, so they are recomputed from the fee config once, as a
 * best-effort reconstruction.
 */
const enrichGiftOrder = (order, feeDefaults) => {
    const packageAmount = order.items
        .filter((item) => item.type === 'PACKAGE')
        .reduce((sum, item) => sum + item.lineTotal, 0);
    const cashGiftAmount = Number(order.cashGiftAmount || 0);
    const feeConfig = (0, fees_js_1.resolveGiftFeeConfig)(order.event, feeDefaults);
    const hasStoredSettlement = Number(order.ownerNetAmount || 0) > 0 ||
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
        : (0, fees_js_1.computeGiftSettlement)({ packageAmount, cashGiftAmount, config: feeConfig });
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
        adminRetainedAmount: roundMoney(Math.max(0, settlement.packageAmount +
            cashGiftAmount -
            settlement.ownerNetAmount -
            settlement.processingFeeAmount)),
        settlementFrozen: hasStoredSettlement,
    };
};
// ============================================
// Public gifting APIs
// ============================================
router.get('/public/:slug/options', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const event = await prisma_js_1.default.event.findUnique({
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
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
    const eventPackageLinks = await prisma_js_1.default.eventGiftPackage.findMany({
        where: { eventId: event.id },
        select: { giftPackageId: true },
    });
    const assignedPackageIds = eventPackageLinks.map((link) => link.giftPackageId);
    const packages = event.giftItemsEnabled
        ? await prisma_js_1.default.giftPackage.findMany({
            where: {
                isActive: true,
                ...(assignedPackageIds.length ? { id: { in: assignedPackageIds } } : {}),
            },
            orderBy: [{ price: 'asc' }, { createdAt: 'desc' }],
        })
        : [];
    const { ownerId, domains: eventDomains, ...eventPublic } = event;
    // Where "Back to event" should go: the custom domain when one is live.
    const eventUrl = (0, siteUrl_js_1.buildEventPublicUrl)(event.slug, '', eventDomains || []);
    const eventGateways = await prisma_js_1.default.eventPaymentGateway.findMany({
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
        ? await prisma_js_1.default.owner.findUnique({
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
    const walletState = (0, walletPolicy_js_1.resolveOwnerWalletState)((ownerProfile?.wallets || []));
    const visibleGateways = (0, walletPolicy_js_1.filterEventGatewaysForOwner)({
        eventGateways: eventGateways,
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
                thumbnailUrl: pkg.thumbnailPath ? (0, supabaseStorage_js_1.buildPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, pkg.thumbnailPath) : null,
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
            const publicKey = gateway.gateway === 'paystack'
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
                splitConfig: gateway.gateway === 'paystack' && paystackWallet?.paystackSubaccount
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
router.post('/public/:slug/checkout', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const data = checkoutSchema.parse(req.body);
    const packageItems = data.packageItems || [];
    const cashGiftAmount = data.cashGiftAmount || 0;
    if (!packageItems.length && cashGiftAmount <= 0) {
        throw new errorHandler_js_1.AppError('Please select a cash gift amount and/or at least one package', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
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
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
    // The page hides the kind it cannot take, but the rule belongs here too:
    // a stale tab or a direct API call must not slip past it.
    if (packageItems.length && !event.giftItemsEnabled) {
        throw new errorHandler_js_1.AppError('This event is not accepting gift items', 400);
    }
    if (cashGiftAmount > 0 && !event.cashGiftsEnabled) {
        throw new errorHandler_js_1.AppError('This event is not accepting cash gifts', 400);
    }
    const configuredGateways = await prisma_js_1.default.eventPaymentGateway.findMany({
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
    const eventPackageLinks = await prisma_js_1.default.eventGiftPackage.findMany({
        where: { eventId: event.id },
        select: { giftPackageId: true },
    });
    const assignedPackageIds = eventPackageLinks.map((link) => link.giftPackageId);
    const giftPackages = packageItems.length
        ? await prisma_js_1.default.giftPackage.findMany({
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
        if (!pkg)
            throw new errorHandler_js_1.AppError('One or more gift packages are unavailable', 400);
        // Checked here for a clear message; fulfilment re-checks atomically,
        // because two guests can pass this point at the same moment.
        const remaining = remainingStock(pkg);
        if (remaining !== null && item.quantity > remaining) {
            throw new errorHandler_js_1.AppError(remaining === 0
                ? `${pkg.name} is out of stock`
                : `Only ${remaining} of ${pkg.name} left`, 400);
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
    const ownerWalletState = (0, walletPolicy_js_1.resolveOwnerWalletState)((event.Owner?.wallets || []));
    const visibleGateways = (0, walletPolicy_js_1.filterEventGatewaysForOwner)({
        eventGateways: configuredGateways,
        walletState: ownerWalletState,
    });
    if (!visibleGateways.length) {
        throw new errorHandler_js_1.AppError('No payment gateway is enabled for this event', 400);
    }
    const selectedGateway = requestedGatewayId
        ? visibleGateways.find((gateway) => gateway.paymentGatewayId === requestedGatewayId)
        : requestedPaymentMethod
            ? visibleGateways.find((gateway) => gateway.paymentGateway.gateway === requestedPaymentMethod)
            : visibleGateways[0];
    if (!selectedGateway) {
        throw new errorHandler_js_1.AppError('Selected payment gateway is not enabled for this event', 400);
    }
    if (selectedGateway &&
        requestedPaymentMethod &&
        selectedGateway.paymentGateway.gateway !== requestedPaymentMethod) {
        throw new errorHandler_js_1.AppError('Payment method does not match selected gateway', 400);
    }
    const totalAmount = packagesTotal + cashGiftAmount;
    const currency = giftPackages[0]?.currency || selectedGateway?.paymentGateway.currency || 'USD';
    if (selectedGateway &&
        selectedGateway.paymentGateway.currency &&
        selectedGateway.paymentGateway.currency.toUpperCase() !== currency.toUpperCase()) {
        throw new errorHandler_js_1.AppError(`Selected gateway currency (${selectedGateway.paymentGateway.currency.toUpperCase()}) does not match order currency (${currency.toUpperCase()})`, 400);
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
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim() ||
        (0, crypto_1.createHash)('sha256').update(idempotencySeed).digest('hex');
    // Cash gifts settle to the owner when they have a verified account on the
    // gateway being paid with. Everything else settles to the platform.
    const selectedGatewayType = String(selectedGateway.paymentGateway.gateway || '').toLowerCase();
    const ownerWallet = ownerWalletState.walletByType.get(selectedGatewayType) || null;
    const ownerConnectedAccountId = (0, walletPolicy_js_1.connectedAccountIdForWallet)(ownerWallet, selectedGatewayType);
    const { intent, nextAction } = await (0, paymentCore_js_1.createPaymentIntent)({
        eventId: event.id,
        purpose: 'GIFT',
        amount: totalAmount,
        currency,
        paymentGatewayId: selectedGateway.paymentGatewayId,
        giftBreakdown: { packageAmount: packagesTotal, cashGiftAmount },
        ownerConnectedAccount: cashGiftAmount > 0 && ownerConnectedAccountId
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
                domains: (event.domains || []),
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
                cashGift: cashGiftAmount <= 0
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
router.get('/public/:slug/order-status', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const reference = String(req.query.reference || '').trim();
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            name: true,
            giftingEnabled: true,
            domains: { select: { host: true, status: true, isPrimary: true } },
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const eventUrl = (0, siteUrl_js_1.buildEventPublicUrl)(event.slug, '', event.domains || []);
    const giftUrl = (0, siteUrl_js_1.buildEventPublicUrl)(event.slug, '/gift', event.domains || []);
    const baseResponse = {
        event: { name: event.name, slug: event.slug },
        eventUrl,
        giftUrl,
    };
    if (!reference) {
        return res.json({ ...baseResponse, status: 'UNKNOWN', order: null });
    }
    const intent = await prisma_js_1.default.paymentIntent.findFirst({
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
            await (0, paymentCore_js_1.verifyGatewayTransaction)(intent.id, reference);
        }
        catch (error) {
            // A gateway that cannot be reached must not turn into a false failure;
            // the webhook is still the source of truth and will land shortly.
            console.warn('[Gift status] verification failed', {
                intentId: intent.id,
                error: error?.message,
            });
        }
    }
    const settled = await prisma_js_1.default.paymentIntent.findUnique({ where: { id: intent.id } });
    const order = await prisma_js_1.default.giftOrder.findFirst({
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
    const status = order || settled?.status === 'SUCCEEDED'
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
                items: (order.items || []).map((item) => ({
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
router.get('/packages', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const packages = await prisma_js_1.default.giftPackage.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({
        packages: packages.map((pkg) => ({
            ...pkg,
            thumbnailUrl: pkg.thumbnailPath ? (0, supabaseStorage_js_1.buildPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, pkg.thumbnailPath) : null,
            remainingStock: remainingStock(pkg),
        })),
    });
}));
router.post('/packages/upload-image', auth_js_1.authenticateAdmin, giftPackageImageUpload.single('image'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!req.file) {
        throw new errorHandler_js_1.AppError('Package photo is required', 400);
    }
    const extByMime = {
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
    const storagePath = `gift-packages/${now.getUTCFullYear()}/${month}/${(0, crypto_1.randomUUID)()}.${extension}`;
    const upload = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, storagePath, req.file.buffer, {
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
router.post('/packages', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = packageSchema.parse(req.body);
    const giftPackage = await prisma_js_1.default.giftPackage.create({
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
router.patch('/packages/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = packageSchema.partial().parse(req.body);
    const giftPackage = await prisma_js_1.default.giftPackage.update({
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
router.delete('/packages/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    await prisma_js_1.default.giftPackage.delete({ where: { id: req.params.id } });
    res.json({ message: 'Package deleted' });
}));
router.get('/events/:eventId/packages', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true, name: true, giftingEnabled: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const [packages, assigned] = await Promise.all([
        prisma_js_1.default.giftPackage.findMany({
            orderBy: [{ isActive: 'desc' }, { price: 'asc' }, { createdAt: 'desc' }],
        }),
        prisma_js_1.default.eventGiftPackage.findMany({
            where: { eventId },
            select: { giftPackageId: true },
        }),
    ]);
    const assignedSet = new Set(assigned.map((row) => row.giftPackageId));
    res.json({
        event,
        assignedPackageIds: Array.from(assignedSet),
        packages: packages.map((pkg) => ({
            ...pkg,
            thumbnailUrl: pkg.thumbnailPath ? (0, supabaseStorage_js_1.buildPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, pkg.thumbnailPath) : null,
            remainingStock: remainingStock(pkg),
            assigned: assignedSet.has(pkg.id),
        })),
    });
}));
router.put('/events/:eventId/packages', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { packageIds } = assignmentSchema.parse(req.body);
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const uniquePackageIds = Array.from(new Set(packageIds));
    if (uniquePackageIds.length) {
        const valid = await prisma_js_1.default.giftPackage.count({
            where: { id: { in: uniquePackageIds } },
        });
        if (valid !== uniquePackageIds.length) {
            throw new errorHandler_js_1.AppError('One or more packages are invalid', 400);
        }
    }
    await prisma_js_1.default.$transaction(async (tx) => {
        await tx.eventGiftPackage.deleteMany({ where: { eventId } });
        if (uniquePackageIds.length) {
            await tx.eventGiftPackage.createMany({
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
router.get('/orders', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
    const where = eventId ? { eventId } : {};
    const feeDefaults = await (0, fees_js_1.getGiftFeeDefaults)();
    const orders = await prisma_js_1.default.giftOrder.findMany({
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
    const enrichedOrders = orders.map((order) => enrichGiftOrder(order, feeDefaults));
    res.json({ orders: enrichedOrders });
}));
router.get('/owner/orders', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const feeDefaults = await (0, fees_js_1.getGiftFeeDefaults)();
    const orders = await prisma_js_1.default.giftOrder.findMany({
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
    const enrichedOrders = orders.map((order) => enrichGiftOrder(order, feeDefaults));
    res.json({ orders: enrichedOrders });
}));
exports.default = router;
//# sourceMappingURL=gifting.js.map