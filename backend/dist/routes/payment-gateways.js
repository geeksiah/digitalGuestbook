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
// PAYMENT GATEWAY SCHEMA
// ============================================
const paymentGatewaySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    gateway: zod_1.z.enum([
        'stripe',
        'paystack',
        'flutterwave',
        'paypal',
        'mtn_momo',
        'telecel_cash',
        'airteltigo_cash',
        'custom',
    ]),
    description: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().default(true),
    isLive: zod_1.z.boolean().default(false),
    // Stripe
    stripePublicKey: zod_1.z.string().optional(),
    stripeSecretKey: zod_1.z.string().optional(),
    stripeWebhookSecret: zod_1.z.string().optional(),
    // Paystack
    paystackPublicKey: zod_1.z.string().optional(),
    paystackSecretKey: zod_1.z.string().optional(),
    // Flutterwave
    flutterwavePublicKey: zod_1.z.string().optional(),
    flutterwaveSecretKey: zod_1.z.string().optional(),
    // MTN MoMo
    mtnMomoApiKey: zod_1.z.string().optional(),
    mtnMomoApiSecret: zod_1.z.string().optional(),
    mtnMomoSubscriptionKey: zod_1.z.string().optional(),
    mtnMomoEnvironment: zod_1.z.enum(['sandbox', 'production']).optional(),
    // Telecel Cash
    telecelCashApiKey: zod_1.z.string().optional(),
    telecelCashApiSecret: zod_1.z.string().optional(),
    telecelCashMerchantId: zod_1.z.string().optional(),
    // Airteltigo Cash
    airteltigoCashApiKey: zod_1.z.string().optional(),
    airteltigoCashApiSecret: zod_1.z.string().optional(),
    airteltigoCashMerchantId: zod_1.z.string().optional(),
    // Custom Gateway
    customGatewayName: zod_1.z.string().optional(),
    customGatewayApiUrl: zod_1.z.string().optional(),
    customGatewayApiKey: zod_1.z.string().optional(),
    customGatewayApiSecret: zod_1.z.string().optional(),
    customGatewayConfig: zod_1.z.string().optional(),
    // Common
    currency: zod_1.z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
        .transform((value) => value.toUpperCase())
        .default('USD'),
    successUrl: zod_1.z.string().optional(),
    cancelUrl: zod_1.z.string().optional(),
});
// ============================================
// SYSTEM-WIDE PAYMENT GATEWAY MANAGEMENT
// ============================================
/**
 * GET /api/payment-gateways
 * Get all system-wide payment gateways
 */
router.get('/', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const gateways = await prisma_js_1.default.paymentGateway.findMany({
        orderBy: { createdAt: 'desc' },
    });
    // Mask sensitive keys
    const masked = gateways.map((g) => {
        if (g.stripeSecretKey)
            g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
        if (g.stripeWebhookSecret)
            g.stripeWebhookSecret = '****';
        if (g.paystackSecretKey)
            g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
        if (g.flutterwaveSecretKey)
            g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
        if (g.mtnMomoApiSecret)
            g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
        if (g.telecelCashApiSecret)
            g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
        if (g.airteltigoCashApiSecret)
            g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
        if (g.customGatewayApiSecret)
            g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
        return g;
    });
    res.json({ gateways: masked });
}));
/**
 * GET /api/payment-gateways/:id
 * Get a specific payment gateway
 */
router.get('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const gateway = await prisma_js_1.default.paymentGateway.findUnique({
        where: { id },
        include: {
            events: {
                include: {
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
    });
    if (!gateway) {
        throw new errorHandler_js_1.AppError('Payment gateway not found', 404);
    }
    // Mask sensitive keys
    const masked = { ...gateway };
    if (masked.stripeSecretKey)
        masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
    if (masked.stripeWebhookSecret)
        masked.stripeWebhookSecret = '****';
    if (masked.paystackSecretKey)
        masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
    if (masked.flutterwaveSecretKey)
        masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
    if (masked.mtnMomoApiSecret)
        masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
    if (masked.telecelCashApiSecret)
        masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
    if (masked.airteltigoCashApiSecret)
        masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
    if (masked.customGatewayApiSecret)
        masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);
    res.json({ gateway: masked });
}));
/**
 * POST /api/payment-gateways
 * Create a new system-wide payment gateway
 */
router.post('/', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = paymentGatewaySchema.parse(req.body);
    // Don't overwrite masked values if updating
    const cleanData = { ...data };
    if (cleanData.stripeSecretKey?.startsWith('****'))
        delete cleanData.stripeSecretKey;
    if (cleanData.stripeWebhookSecret === '****')
        delete cleanData.stripeWebhookSecret;
    if (cleanData.paystackSecretKey?.startsWith('****'))
        delete cleanData.paystackSecretKey;
    if (cleanData.flutterwaveSecretKey?.startsWith('****'))
        delete cleanData.flutterwaveSecretKey;
    if (cleanData.mtnMomoApiSecret?.startsWith('****'))
        delete cleanData.mtnMomoApiSecret;
    if (cleanData.telecelCashApiSecret?.startsWith('****'))
        delete cleanData.telecelCashApiSecret;
    if (cleanData.airteltigoCashApiSecret?.startsWith('****'))
        delete cleanData.airteltigoCashApiSecret;
    if (cleanData.customGatewayApiSecret?.startsWith('****'))
        delete cleanData.customGatewayApiSecret;
    const gateway = await prisma_js_1.default.paymentGateway.create({
        data: cleanData,
    });
    // Mask sensitive keys in response
    const masked = { ...gateway };
    if (masked.stripeSecretKey)
        masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
    if (masked.stripeWebhookSecret)
        masked.stripeWebhookSecret = '****';
    if (masked.paystackSecretKey)
        masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
    if (masked.flutterwaveSecretKey)
        masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
    if (masked.mtnMomoApiSecret)
        masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
    if (masked.telecelCashApiSecret)
        masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
    if (masked.airteltigoCashApiSecret)
        masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
    if (masked.customGatewayApiSecret)
        masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);
    res.status(201).json({ gateway: masked });
}));
/**
 * PUT /api/payment-gateways/:id
 * Update a payment gateway
 */
router.put('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const data = paymentGatewaySchema.partial().parse(req.body);
    const existing = await prisma_js_1.default.paymentGateway.findUnique({ where: { id } });
    if (!existing) {
        throw new errorHandler_js_1.AppError('Payment gateway not found', 404);
    }
    // Don't overwrite masked values
    const cleanData = { ...data };
    if (cleanData.stripeSecretKey?.startsWith('****'))
        delete cleanData.stripeSecretKey;
    if (cleanData.stripeWebhookSecret === '****')
        delete cleanData.stripeWebhookSecret;
    if (cleanData.paystackSecretKey?.startsWith('****'))
        delete cleanData.paystackSecretKey;
    if (cleanData.flutterwaveSecretKey?.startsWith('****'))
        delete cleanData.flutterwaveSecretKey;
    if (cleanData.mtnMomoApiSecret?.startsWith('****'))
        delete cleanData.mtnMomoApiSecret;
    if (cleanData.telecelCashApiSecret?.startsWith('****'))
        delete cleanData.telecelCashApiSecret;
    if (cleanData.airteltigoCashApiSecret?.startsWith('****'))
        delete cleanData.airteltigoCashApiSecret;
    if (cleanData.customGatewayApiSecret?.startsWith('****'))
        delete cleanData.customGatewayApiSecret;
    const gateway = await prisma_js_1.default.paymentGateway.update({
        where: { id },
        data: cleanData,
    });
    // Mask sensitive keys in response
    const masked = { ...gateway };
    if (masked.stripeSecretKey)
        masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
    if (masked.stripeWebhookSecret)
        masked.stripeWebhookSecret = '****';
    if (masked.paystackSecretKey)
        masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
    if (masked.flutterwaveSecretKey)
        masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
    if (masked.mtnMomoApiSecret)
        masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
    if (masked.telecelCashApiSecret)
        masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
    if (masked.airteltigoCashApiSecret)
        masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
    if (masked.customGatewayApiSecret)
        masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);
    res.json({ gateway: masked });
}));
/**
 * DELETE /api/payment-gateways/:id
 * Delete a payment gateway (only if not used by any events)
 */
router.delete('/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    // Check if gateway is used by any events
    const usage = await prisma_js_1.default.eventPaymentGateway.count({
        where: { paymentGatewayId: id },
    });
    if (usage > 0) {
        throw new errorHandler_js_1.AppError(`Cannot delete payment gateway: it is currently used by ${usage} event(s). Remove it from all events first.`, 400);
    }
    await prisma_js_1.default.paymentGateway.delete({
        where: { id },
    });
    res.json({ message: 'Payment gateway deleted' });
}));
// ============================================
// EVENT-SPECIFIC GATEWAY SELECTION
// ============================================
/**
 * GET /api/payment-gateways/events/:eventId
 * Get payment gateways enabled for an event
 */
router.get('/events/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const eventGateways = await prisma_js_1.default.eventPaymentGateway.findMany({
        where: { eventId },
        include: {
            paymentGateway: true,
        },
        orderBy: { sortOrder: 'asc' },
    });
    // Mask sensitive keys
    const masked = eventGateways.map((eg) => {
        const g = eg.paymentGateway;
        if (g.stripeSecretKey)
            g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
        if (g.stripeWebhookSecret)
            g.stripeWebhookSecret = '****';
        if (g.paystackSecretKey)
            g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
        if (g.flutterwaveSecretKey)
            g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
        if (g.mtnMomoApiSecret)
            g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
        if (g.telecelCashApiSecret)
            g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
        if (g.airteltigoCashApiSecret)
            g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
        if (g.customGatewayApiSecret)
            g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
        return eg;
    });
    res.json({ eventGateways: masked });
}));
/**
 * PUT /api/payment-gateways/events/:eventId
 * Update payment gateways for an event (replace all)
 */
router.put('/events/:eventId', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { gatewayIds } = req.body; // Array of { paymentGatewayId, isActive, sortOrder }
    if (!Array.isArray(gatewayIds)) {
        throw new errorHandler_js_1.AppError('gatewayIds must be an array', 400);
    }
    // Verify event exists
    const event = await prisma_js_1.default.event.findUnique({ where: { id: eventId } });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    // Delete existing event gateway associations
    await prisma_js_1.default.eventPaymentGateway.deleteMany({
        where: { eventId },
    });
    // Create new associations
    const eventGateways = await Promise.all(gatewayIds.map((item, index) => prisma_js_1.default.eventPaymentGateway.create({
        data: {
            eventId,
            paymentGatewayId: item.paymentGatewayId || item.id,
            isActive: item.isActive !== false,
            sortOrder: item.sortOrder !== undefined ? item.sortOrder : index,
        },
        include: {
            paymentGateway: true,
        },
    })));
    // Mask sensitive keys
    const masked = eventGateways.map((eg) => {
        const g = eg.paymentGateway;
        if (g.stripeSecretKey)
            g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
        if (g.stripeWebhookSecret)
            g.stripeWebhookSecret = '****';
        if (g.paystackSecretKey)
            g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
        if (g.flutterwaveSecretKey)
            g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
        if (g.mtnMomoApiSecret)
            g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
        if (g.telecelCashApiSecret)
            g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
        if (g.airteltigoCashApiSecret)
            g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
        if (g.customGatewayApiSecret)
            g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
        return eg;
    });
    res.json({ eventGateways: masked });
}));
exports.default = router;
//# sourceMappingURL=payment-gateways.js.map