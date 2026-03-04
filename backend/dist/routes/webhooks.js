"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const express_1 = require("express");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const paystack_js_1 = require("../services/paystack.js");
const paymentCore_js_1 = require("../services/paymentCore.js");
const payoutAutomation_js_1 = require("../services/payoutAutomation.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const router = (0, express_1.Router)();
const getRawPayload = (body) => {
    if (Buffer.isBuffer(body))
        return body.toString('utf8');
    if (typeof body === 'string')
        return body;
    return JSON.stringify(body || {});
};
const parsePayload = (rawPayload) => {
    try {
        return JSON.parse(rawPayload);
    }
    catch {
        throw new errorHandler_js_1.AppError('Invalid webhook JSON payload', 400);
    }
};
const verifyStripeSignature = async (rawPayload, signatureHeader) => {
    const provided = String(signatureHeader || '').trim();
    if (!provided)
        return false;
    const stripeGateway = await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            gateway: 'stripe',
            isActive: true,
        },
        orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
        select: { stripeWebhookSecret: true },
    });
    const secret = String(stripeGateway?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
    if (!secret)
        throw new errorHandler_js_1.AppError('Stripe webhook secret is not configured', 400);
    const parts = provided.split(',').map((entry) => entry.trim());
    const timestampPart = parts.find((entry) => entry.startsWith('t='));
    const v1Part = parts.find((entry) => entry.startsWith('v1='));
    if (!timestampPart || !v1Part)
        return false;
    const timestamp = timestampPart.slice(2);
    const receivedSignature = v1Part.slice(3);
    const payloadToSign = `${timestamp}.${rawPayload}`;
    const computed = (0, crypto_1.createHmac)('sha256', secret).update(payloadToSign).digest('hex');
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(computed), Buffer.from(receivedSignature));
    }
    catch {
        return false;
    }
};
const verifyHubtelSignature = async (rawPayload, signatureHeader) => {
    const provided = String(signatureHeader || '').trim();
    if (!provided)
        return false;
    const hubtelGateway = await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            gateway: 'hubtel',
            isActive: true,
        },
        orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
        select: {
            hubtelWebhookSecret: true,
        },
    });
    const secret = String(hubtelGateway?.hubtelWebhookSecret || process.env.HUBTEL_WEBHOOK_SECRET || '').trim();
    if (!secret)
        throw new errorHandler_js_1.AppError('Hubtel webhook secret is not configured', 400);
    const computed = (0, crypto_1.createHmac)('sha256', secret).update(rawPayload).digest('hex');
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(computed), Buffer.from(provided));
    }
    catch {
        return false;
    }
};
router.post('/paystack', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('x-paystack-signature');
    const valid = await (0, paystack_js_1.verifyPaystackWebhookSignature)(Buffer.from(rawPayload, 'utf8'), signature);
    if (!valid)
        throw new errorHandler_js_1.AppError('Invalid Paystack webhook signature', 401);
    const payload = parsePayload(rawPayload);
    const eventName = String(payload?.event || '');
    if (eventName.toLowerCase().startsWith('transfer.')) {
        await (0, payoutAutomation_js_1.reconcilePaystackTransfer)({
            eventName,
            payload,
            rawPayload,
        });
    }
    const result = await (0, paymentCore_js_1.handleWebhook)({
        gateway: 'paystack',
        payload,
        rawPayload,
    });
    res.json(result);
}));
router.post('/stripe', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('stripe-signature');
    const valid = await verifyStripeSignature(rawPayload, signature || undefined);
    if (!valid)
        throw new errorHandler_js_1.AppError('Invalid Stripe webhook signature', 401);
    const payload = parsePayload(rawPayload);
    const result = await (0, paymentCore_js_1.handleWebhook)({
        gateway: 'stripe',
        payload,
        rawPayload,
    });
    res.json(result);
}));
router.post('/hubtel', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('x-hubtel-signature');
    const valid = await verifyHubtelSignature(rawPayload, signature || undefined);
    if (!valid)
        throw new errorHandler_js_1.AppError('Invalid Hubtel webhook signature', 401);
    const payload = parsePayload(rawPayload);
    const result = await (0, paymentCore_js_1.handleWebhook)({
        gateway: 'hubtel',
        payload,
        rawPayload,
    });
    res.json(result);
}));
exports.default = router;
//# sourceMappingURL=webhooks.js.map