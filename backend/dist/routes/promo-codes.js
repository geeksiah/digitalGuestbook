"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// ============================================
// VALIDATION SCHEMAS
// ============================================
const promoCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/i, 'Code can only contain letters, numbers, hyphens, and underscores'),
    description: zod_1.z.string().optional(),
    discountType: zod_1.z.enum(['PERCENT', 'FIXED']),
    discountValue: zod_1.z.number().min(0),
    minimumPurchase: zod_1.z.number().min(0).optional(),
    maximumDiscount: zod_1.z.number().min(0).optional(),
    ticketTypeIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    usageLimit: zod_1.z.number().int().min(1).optional(),
    maxPerUser: zod_1.z.number().int().min(1).default(1),
    validFrom: zod_1.z.string().datetime().optional(),
    validUntil: zod_1.z.string().datetime().optional(),
    isActive: zod_1.z.boolean().default(true),
});
const updatePromoCodeSchema = promoCodeSchema.partial();
const validatePromoCodeSchema = zod_1.z.object({
    code: zod_1.z.string().min(1),
    eventId: zod_1.z.string().uuid(),
    ticketTypeId: zod_1.z.string().uuid().optional(),
    amount: zod_1.z.number().min(0),
});
// ============================================
// ADMIN ENDPOINTS
// ============================================
/**
 * GET /api/promo-codes/events/:eventId
 * Get all promo codes for an event
 */
router.get('/events/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const codes = await prisma_js_1.default.promoCode.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
    });
    // Parse ticketTypeIds JSON
    const codesWithParsed = codes.map(code => ({
        ...code,
        ticketTypeIds: code.ticketTypeIds ? JSON.parse(code.ticketTypeIds) : null,
    }));
    res.json({ codes: codesWithParsed });
}));
/**
 * POST /api/promo-codes/events/:eventId
 * Create a new promo code
 */
router.post('/events/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const data = promoCodeSchema.parse(req.body);
    // Check if code already exists for this event
    const existing = await prisma_js_1.default.promoCode.findUnique({
        where: { eventId_code: { eventId, code: data.code.toUpperCase() } },
    });
    if (existing) {
        throw new errorHandler_js_1.AppError('Promo code already exists for this event', 400);
    }
    // Validate maximumDiscount is set for percentage discounts
    if (data.discountType === 'PERCENT' && !data.maximumDiscount) {
        throw new errorHandler_js_1.AppError('maximumDiscount is required for percentage discounts', 400);
    }
    const code = await prisma_js_1.default.promoCode.create({
        data: {
            eventId,
            code: data.code.toUpperCase(),
            description: data.description || null,
            discountType: data.discountType,
            discountValue: data.discountValue,
            minimumPurchase: data.minimumPurchase || null,
            maximumDiscount: data.maximumDiscount || null,
            ticketTypeIds: data.ticketTypeIds ? JSON.stringify(data.ticketTypeIds) : null,
            usageLimit: data.usageLimit || null,
            maxPerUser: data.maxPerUser,
            validFrom: data.validFrom ? new Date(data.validFrom) : null,
            validUntil: data.validUntil ? new Date(data.validUntil) : null,
            isActive: data.isActive,
        },
    });
    res.status(201).json({ code: { ...code, ticketTypeIds: code.ticketTypeIds ? JSON.parse(code.ticketTypeIds) : null } });
}));
/**
 * PUT /api/promo-codes/:id
 * Update a promo code
 */
router.put('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = updatePromoCodeSchema.parse(req.body);
    const existing = await prisma_js_1.default.promoCode.findUnique({ where: { id } });
    if (!existing) {
        throw new errorHandler_js_1.AppError('Promo code not found', 404);
    }
    // If code is being changed, check uniqueness
    if (data.code && data.code.toUpperCase() !== existing.code) {
        const duplicate = await prisma_js_1.default.promoCode.findUnique({
            where: { eventId_code: { eventId: existing.eventId, code: data.code.toUpperCase() } },
        });
        if (duplicate) {
            throw new errorHandler_js_1.AppError('Promo code already exists for this event', 400);
        }
    }
    const updateData = {};
    if (data.code !== undefined)
        updateData.code = data.code.toUpperCase();
    if (data.description !== undefined)
        updateData.description = data.description || null;
    if (data.discountType !== undefined)
        updateData.discountType = data.discountType;
    if (data.discountValue !== undefined)
        updateData.discountValue = data.discountValue;
    if (data.minimumPurchase !== undefined)
        updateData.minimumPurchase = data.minimumPurchase || null;
    if (data.maximumDiscount !== undefined)
        updateData.maximumDiscount = data.maximumDiscount || null;
    if (data.ticketTypeIds !== undefined)
        updateData.ticketTypeIds = data.ticketTypeIds ? JSON.stringify(data.ticketTypeIds) : null;
    if (data.usageLimit !== undefined)
        updateData.usageLimit = data.usageLimit || null;
    if (data.maxPerUser !== undefined)
        updateData.maxPerUser = data.maxPerUser;
    if (data.validFrom !== undefined)
        updateData.validFrom = data.validFrom ? new Date(data.validFrom) : null;
    if (data.validUntil !== undefined)
        updateData.validUntil = data.validUntil ? new Date(data.validUntil) : null;
    if (data.isActive !== undefined)
        updateData.isActive = data.isActive;
    const code = await prisma_js_1.default.promoCode.update({
        where: { id },
        data: updateData,
    });
    res.json({ code: { ...code, ticketTypeIds: code.ticketTypeIds ? JSON.parse(code.ticketTypeIds) : null } });
}));
/**
 * DELETE /api/promo-codes/:id
 * Delete a promo code
 */
router.delete('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    await prisma_js_1.default.promoCode.delete({
        where: { id },
    });
    res.json({ message: 'Promo code deleted' });
}));
// ============================================
// PUBLIC ENDPOINTS
// ============================================
/**
 * POST /api/promo-codes/validate
 * Validate a promo code for a ticket purchase
 */
router.post('/validate', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { code, eventId, ticketTypeId, amount } = validatePromoCodeSchema.parse(req.body);
    const promoCode = await prisma_js_1.default.promoCode.findUnique({
        where: { eventId_code: { eventId, code: code.toUpperCase() } },
        include: { event: true },
    });
    if (!promoCode) {
        return res.json({ valid: false, error: 'Invalid promo code' });
    }
    // Check if active
    if (!promoCode.isActive) {
        return res.json({ valid: false, error: 'Promo code is not active' });
    }
    // Check validity dates
    const now = new Date();
    if (promoCode.validFrom && new Date(promoCode.validFrom) > now) {
        return res.json({ valid: false, error: 'Promo code is not yet valid' });
    }
    if (promoCode.validUntil && new Date(promoCode.validUntil) < now) {
        return res.json({ valid: false, error: 'Promo code has expired' });
    }
    // Check usage limit
    if (promoCode.usageLimit && promoCode.usageCount >= promoCode.usageLimit) {
        return res.json({ valid: false, error: 'Promo code usage limit reached' });
    }
    // Check ticket type applicability
    if (promoCode.ticketTypeIds && ticketTypeId !== undefined) {
        const applicableTypes = JSON.parse(promoCode.ticketTypeIds);
        if (!applicableTypes.includes(ticketTypeId)) {
            return res.json({ valid: false, error: 'Promo code does not apply to this ticket type' });
        }
    }
    // Check minimum purchase
    if (promoCode.minimumPurchase && amount < promoCode.minimumPurchase) {
        return res.json({
            valid: false,
            error: `Minimum purchase of ${promoCode.minimumPurchase} required`
        });
    }
    // Calculate discount
    let discount = 0;
    if (promoCode.discountType === 'PERCENT') {
        discount = (amount * promoCode.discountValue) / 100;
        if (promoCode.maximumDiscount) {
            discount = Math.min(discount, promoCode.maximumDiscount);
        }
    }
    else {
        discount = promoCode.discountValue;
    }
    const finalAmount = Math.max(0, amount - discount);
    res.json({
        valid: true,
        promoCode: {
            id: promoCode.id,
            code: promoCode.code,
            discountType: promoCode.discountType,
            discountValue: promoCode.discountValue,
        },
        discount,
        originalAmount: amount,
        finalAmount,
    });
}));
exports.default = router;
//# sourceMappingURL=promo-codes.js.map