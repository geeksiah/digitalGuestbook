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
const paystack_js_1 = require("../services/paystack.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const fees_js_1 = require("../utils/fees.js");
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
});
const checkoutSchema = zod_1.z.object({
    guestName: zod_1.z.string().min(2),
    guestPhone: zod_1.z.string().optional().nullable(),
    guestEmail: zod_1.z.string().email().optional().nullable(),
    paymentGatewayId: zod_1.z.string().uuid().optional().nullable(),
    paymentMethod: zod_1.z.string().optional().nullable(),
    paymentReference: zod_1.z.string().optional().nullable(),
    note: zod_1.z.string().optional().nullable(),
    deliveryDate: zod_1.z.string().datetime().optional().nullable(),
    cashGiftAmount: zod_1.z.number().min(0).optional().nullable(),
    packageItems: zod_1.z.array(zod_1.z.object({
        giftPackageId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).default(1),
    })).optional(),
});
const assignmentSchema = zod_1.z.object({
    packageIds: zod_1.z.array(zod_1.z.string().uuid()).default([]),
});
const roundMoney = (value) => Math.round(value * 100) / 100;
const computeSettlement = (input) => {
    const cashGiftAmount = Math.max(0, Number(input.cashGiftAmount || 0));
    const packageAmount = Math.max(0, Number(input.packageAmount || 0));
    const mode = String(input.platformFeeMode || 'PERCENTAGE').toUpperCase();
    const percent = Math.max(0, Number(input.platformFeePercent || 0));
    const fixed = Math.max(0, Number(input.platformFeeFixed || 0));
    const ownerFee = mode === 'FIXED'
        ? Math.min(cashGiftAmount, fixed)
        : (cashGiftAmount * percent) / 100;
    const ownerNetAmount = roundMoney(Math.max(0, cashGiftAmount - ownerFee));
    const adminRetainedAmount = roundMoney(packageAmount + ownerFee);
    return {
        ownerFee: roundMoney(ownerFee),
        ownerNetAmount,
        adminRetainedAmount,
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
            coverImagePath: true,
            coverImageAlt: true,
            socialTitle: true,
            socialDescription: true,
            ownerId: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
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
    const packages = await prisma_js_1.default.giftPackage.findMany({
        where: {
            isActive: true,
            ...(assignedPackageIds.length ? { id: { in: assignedPackageIds } } : {}),
        },
        orderBy: [{ price: 'asc' }, { createdAt: 'desc' }],
    });
    const { ownerId, ...eventPublic } = event;
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
    const ownerWallet = event.ownerId
        ? await prisma_js_1.default.ownerWallet.findUnique({
            where: { ownerId: event.ownerId },
            select: { paystackSubaccount: true, isVerified: true },
        })
        : null;
    res.json({
        event: eventPublic,
        packages,
        momoEnabled: true,
        settlementPolicy: {
            cashGift: ownerWallet?.paystackSubaccount ? 'split_to_owner_subaccount' : 'platform_settlement',
            packagePurchase: 'platform_only',
            mixedPaystackCheckoutAllowed: false,
        },
        paymentGateways: eventGateways.map((eventGateway) => {
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
                splitConfig: gateway.gateway === 'paystack' && ownerWallet?.paystackSubaccount
                    ? {
                        subaccount: ownerWallet.paystackSubaccount,
                        bearer: 'subaccount',
                        ownerWalletVerified: Boolean(ownerWallet.isVerified),
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
            ownerId: true,
            feeOverridesEnabled: true,
            platformFeeMode: true,
            platformFeePercent: true,
            platformFeeFixed: true,
            processingFeePercent: true,
            processingFeeFixed: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
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
    const lines = packageItems.map((item) => {
        const pkg = giftPackages.find((p) => p.id === item.giftPackageId);
        if (!pkg)
            throw new errorHandler_js_1.AppError('One or more gift packages are unavailable', 400);
        const lineTotal = pkg.price * item.quantity;
        packagesTotal += lineTotal;
        return {
            giftPackageId: pkg.id,
            type: 'PACKAGE',
            quantity: item.quantity,
            unitPrice: pkg.price,
            lineTotal,
        };
    });
    const requestedGatewayId = data.paymentGatewayId || null;
    const requestedPaymentMethod = (data.paymentMethod || '').trim().toLowerCase() || null;
    const selectedGateway = requestedGatewayId
        ? configuredGateways.find((gateway) => gateway.paymentGatewayId === requestedGatewayId)
        : requestedPaymentMethod
            ? configuredGateways.find((gateway) => gateway.paymentGateway.gateway === requestedPaymentMethod)
            : null;
    if (requestedGatewayId && !selectedGateway) {
        throw new errorHandler_js_1.AppError('Selected payment gateway is not enabled for this event', 400);
    }
    if (selectedGateway &&
        requestedPaymentMethod &&
        selectedGateway.paymentGateway.gateway !== requestedPaymentMethod) {
        throw new errorHandler_js_1.AppError('Payment method does not match selected gateway', 400);
    }
    if (configuredGateways.length > 0 &&
        !selectedGateway &&
        (requestedGatewayId || requestedPaymentMethod || data.paymentReference)) {
        throw new errorHandler_js_1.AppError('Please select one of the enabled gateways for this event', 400);
    }
    const paymentMethod = selectedGateway?.paymentGateway.gateway || requestedPaymentMethod || null;
    const totalAmount = packagesTotal + cashGiftAmount;
    const currency = giftPackages[0]?.currency || selectedGateway?.paymentGateway.currency || 'USD';
    const paymentReference = data.paymentReference?.trim() || null;
    const isPaystackPayment = paymentMethod === 'paystack';
    if (selectedGateway &&
        selectedGateway.paymentGateway.currency &&
        selectedGateway.paymentGateway.currency.toUpperCase() !== currency.toUpperCase()) {
        throw new errorHandler_js_1.AppError(`Selected gateway currency (${selectedGateway.paymentGateway.currency.toUpperCase()}) does not match order currency (${currency.toUpperCase()})`, 400);
    }
    if (paymentReference) {
        const duplicate = await prisma_js_1.default.transaction.findFirst({
            where: {
                paymentRef: paymentReference,
                status: 'completed',
            },
            select: { id: true },
        });
        if (duplicate) {
            throw new errorHandler_js_1.AppError('This payment reference has already been used', 400);
        }
    }
    let ownerWallet = null;
    if (event.ownerId) {
        ownerWallet = await prisma_js_1.default.ownerWallet.findUnique({
            where: { ownerId: event.ownerId },
            select: { paystackSubaccount: true, isVerified: true },
        });
    }
    if (isPaystackPayment) {
        if (!paymentReference) {
            throw new errorHandler_js_1.AppError('Payment reference is required for Paystack gifts', 400);
        }
        if (cashGiftAmount > 0 && packagesTotal > 0) {
            throw new errorHandler_js_1.AppError('For secure split settlement, complete cash gift and package purchase as separate payments', 400);
        }
        const verification = await (0, paystack_js_1.verifyPaystackTransaction)(paymentReference);
        const expectedMinor = Math.round(totalAmount * 100);
        const paidMinor = Number(verification.amount || 0);
        if (verification.status !== 'success') {
            throw new errorHandler_js_1.AppError('Paystack payment is not successful', 400);
        }
        if (paidMinor !== expectedMinor) {
            throw new errorHandler_js_1.AppError('Paystack amount does not match order total', 400);
        }
        if ((verification.currency || '').toUpperCase() !== currency.toUpperCase()) {
            throw new errorHandler_js_1.AppError('Paystack currency does not match order currency', 400);
        }
        const expectedSubaccount = ownerWallet?.paystackSubaccount || null;
        const verifiedSubaccount = typeof verification.subaccount === 'string'
            ? verification.subaccount
            : verification.subaccount?.subaccount_code || verification.split?.subaccount || null;
        if (cashGiftAmount > 0 && !expectedSubaccount) {
            throw new errorHandler_js_1.AppError('Owner payout account is not configured for this event. Please complete with MoMo or card, or contact support.', 400);
        }
        if (cashGiftAmount > 0 && expectedSubaccount && verifiedSubaccount !== expectedSubaccount) {
            throw new errorHandler_js_1.AppError('Payment split destination does not match this event owner account', 400);
        }
        if (packagesTotal > 0 && verifiedSubaccount) {
            throw new errorHandler_js_1.AppError('Package purchases must be processed without owner split destination', 400);
        }
        // If no split details are returned on verification, we still rely on amount/currency/reference checks.
        // This fallback keeps backward compatibility for providers that omit split fields.
    }
    const feeDefaults = await (0, fees_js_1.getSystemFeeDefaults)();
    const feeConfig = (0, fees_js_1.resolveEventFeeConfig)(event, feeDefaults);
    const platformFeeMode = feeConfig.platformFeeMode;
    const ownerFeePercent = feeConfig.platformFeePercent;
    const ownerFeeFixed = feeConfig.platformFeeFixed;
    const cashOwnerFee = platformFeeMode === 'FIXED'
        ? Math.min(cashGiftAmount, ownerFeeFixed)
        : (cashGiftAmount * ownerFeePercent) / 100;
    const cashOwnerNet = Math.max(0, cashGiftAmount - cashOwnerFee);
    const order = await prisma_js_1.default.$transaction(async (tx) => {
        const created = await tx.giftOrder.create({
            data: {
                eventId: event.id,
                guestName: data.guestName,
                guestPhone: data.guestPhone || null,
                guestEmail: data.guestEmail || null,
                deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                note: data.note || null,
                paymentMethod: paymentMethod || null,
                paymentReference,
                currency,
                totalAmount,
                cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : null,
                status: paymentReference ? 'PAID' : 'PENDING',
            },
        });
        const orderItems = [...lines];
        if (cashGiftAmount > 0) {
            orderItems.push({
                giftPackageId: null,
                type: 'CASH',
                quantity: 1,
                unitPrice: cashGiftAmount,
                lineTotal: cashGiftAmount,
            });
        }
        if (orderItems.length) {
            await tx.giftOrderItem.createMany({
                data: orderItems.map((item) => ({
                    orderId: created.id,
                    giftPackageId: item.giftPackageId,
                    type: item.type,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    lineTotal: item.lineTotal,
                })),
            });
        }
        await tx.auditLog.create({
            data: {
                eventId: event.id,
                action: 'GIFT_ORDER_CREATED',
                entityType: 'GIFT_ORDER',
                entityId: created.id,
                details: JSON.stringify({
                    totalAmount,
                    currency,
                    hasCashGift: cashGiftAmount > 0,
                    packageCount: lines.length,
                    ownerFeePercent,
                    platformFeeMode,
                    ownerFeeFixed,
                    cashOwnerNet,
                    paymentReference,
                }),
            },
        });
        // Record transaction ledger entries once paid
        if (paymentReference) {
            if (cashGiftAmount > 0) {
                await tx.transaction.create({
                    data: {
                        eventId: event.id,
                        type: 'gift_cash',
                        grossAmount: cashGiftAmount,
                        platformFee: cashOwnerFee,
                        processingFee: 0,
                        netAmount: cashOwnerNet,
                        currency,
                        paymentMethod: paymentMethod || 'unknown',
                        paymentRef: paymentReference,
                        buyerName: data.guestName,
                        buyerEmail: data.guestEmail || null,
                        status: 'completed',
                    },
                });
            }
            if (packagesTotal > 0) {
                await tx.transaction.create({
                    data: {
                        eventId: event.id,
                        type: 'gift_package_sale',
                        grossAmount: packagesTotal,
                        platformFee: packagesTotal,
                        processingFee: 0,
                        netAmount: 0,
                        currency,
                        paymentMethod: paymentMethod || 'unknown',
                        paymentRef: paymentReference,
                        buyerName: data.guestName,
                        buyerEmail: data.guestEmail || null,
                        status: 'completed',
                    },
                });
            }
        }
        return created;
    });
    res.status(201).json({
        success: true,
        order,
        breakdown: {
            totalAmount,
            packageAmount: packagesTotal,
            cashGiftAmount,
            ownerFeePercent,
            platformFeeMode,
            ownerFeeFixed,
            ownerNetCash: cashOwnerNet,
            adminRetainedAmount: packagesTotal + cashOwnerFee,
            settlementPolicy: {
                cashGift: cashGiftAmount > 0 ? 'split_to_owner_subaccount' : 'none',
                packagePurchase: packagesTotal > 0 ? 'platform_only' : 'none',
            },
        },
        message: 'Gift checkout submitted successfully',
    });
}));
// ============================================
// Admin package management
// ============================================
router.get('/packages', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const packages = await prisma_js_1.default.giftPackage.findMany({
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ packages });
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
    const feeDefaults = await (0, fees_js_1.getSystemFeeDefaults)();
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
                },
            },
            items: { include: { giftPackage: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    });
    const enrichedOrders = orders.map((order) => {
        const feeConfig = (0, fees_js_1.resolveEventFeeConfig)(order.event, feeDefaults);
        const packageAmount = order.items
            .filter((item) => item.type === 'PACKAGE')
            .reduce((sum, item) => sum + item.lineTotal, 0);
        const cashGiftAmount = Number(order.cashGiftAmount || 0);
        const settlement = computeSettlement({
            cashGiftAmount,
            packageAmount,
            platformFeeMode: feeConfig.platformFeeMode,
            platformFeePercent: feeConfig.platformFeePercent,
            platformFeeFixed: feeConfig.platformFeeFixed,
        });
        return {
            ...order,
            platformFeeMode: feeConfig.platformFeeMode,
            platformFeePercent: feeConfig.platformFeePercent,
            platformFeeFixed: feeConfig.platformFeeFixed,
            packageAmount,
            ownerNetAmount: settlement.ownerNetAmount,
            adminRetainedAmount: settlement.adminRetainedAmount,
        };
    });
    res.json({ orders: enrichedOrders });
}));
router.get('/owner/orders', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const feeDefaults = await (0, fees_js_1.getSystemFeeDefaults)();
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
                },
            },
            items: { include: { giftPackage: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    });
    const enrichedOrders = orders.map((order) => {
        const feeConfig = (0, fees_js_1.resolveEventFeeConfig)(order.event, feeDefaults);
        const packageAmount = order.items
            .filter((item) => item.type === 'PACKAGE')
            .reduce((sum, item) => sum + item.lineTotal, 0);
        const cashGiftAmount = Number(order.cashGiftAmount || 0);
        const settlement = computeSettlement({
            cashGiftAmount,
            packageAmount,
            platformFeeMode: feeConfig.platformFeeMode,
            platformFeePercent: feeConfig.platformFeePercent,
            platformFeeFixed: feeConfig.platformFeeFixed,
        });
        return {
            ...order,
            platformFeeMode: feeConfig.platformFeeMode,
            platformFeePercent: feeConfig.platformFeePercent,
            platformFeeFixed: feeConfig.platformFeeFixed,
            packageAmount,
            ownerNetAmount: settlement.ownerNetAmount,
            adminRetainedAmount: settlement.adminRetainedAmount,
        };
    });
    res.json({ orders: enrichedOrders });
}));
exports.default = router;
//# sourceMappingURL=gifting.js.map