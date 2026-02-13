"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const router = (0, express_1.Router)();
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
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
    const packages = await prisma_js_1.default.giftPackage.findMany({
        where: { isActive: true },
        orderBy: [{ price: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({
        event,
        packages,
        momoEnabled: true,
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
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
    const giftPackages = packageItems.length
        ? await prisma_js_1.default.giftPackage.findMany({
            where: {
                id: { in: packageItems.map((item) => item.giftPackageId) },
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
    const totalAmount = packagesTotal + cashGiftAmount;
    const currency = giftPackages[0]?.currency || 'USD';
    const order = await prisma_js_1.default.$transaction(async (tx) => {
        const created = await tx.giftOrder.create({
            data: {
                eventId: event.id,
                guestName: data.guestName,
                guestPhone: data.guestPhone || null,
                guestEmail: data.guestEmail || null,
                deliveryDate: data.deliveryDate ? new Date(data.deliveryDate) : null,
                note: data.note || null,
                paymentMethod: data.paymentMethod || null,
                paymentReference: data.paymentReference || null,
                currency,
                totalAmount,
                cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : null,
                status: data.paymentReference ? 'PAID' : 'PENDING',
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
                    paymentReference: data.paymentReference || null,
                }),
            },
        });
        // Reuse transaction contract pattern for payment references
        if (data.paymentReference) {
            await tx.transaction.create({
                data: {
                    eventId: event.id,
                    type: 'gift_sale',
                    grossAmount: totalAmount,
                    platformFee: 0,
                    processingFee: 0,
                    netAmount: totalAmount,
                    currency,
                    paymentMethod: data.paymentMethod || 'unknown',
                    paymentRef: data.paymentReference,
                    buyerName: data.guestName,
                    buyerEmail: data.guestEmail || null,
                    status: 'completed',
                },
            });
        }
        return created;
    });
    res.status(201).json({
        success: true,
        order,
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
// ============================================
// Admin/Owner order listing
// ============================================
router.get('/orders', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const eventId = req.query.eventId ? String(req.query.eventId) : undefined;
    const where = eventId ? { eventId } : {};
    const orders = await prisma_js_1.default.giftOrder.findMany({
        where,
        include: {
            event: { select: { id: true, name: true, slug: true } },
            items: { include: { giftPackage: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
}));
router.get('/owner/orders', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const orders = await prisma_js_1.default.giftOrder.findMany({
        where: {
            event: { ownerId },
        },
        include: {
            event: { select: { id: true, name: true, slug: true } },
            items: { include: { giftPackage: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ orders });
}));
exports.default = router;
//# sourceMappingURL=gifting.js.map