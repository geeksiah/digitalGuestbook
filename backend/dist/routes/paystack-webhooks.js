"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const paystack_js_1 = require("../services/paystack.js");
const payoutAutomation_js_1 = require("../services/payoutAutomation.js");
const router = (0, express_1.Router)();
const db = prisma_js_1.default;
router.get('/health', (_req, res) => {
    res.json({ ok: true, provider: 'paystack' });
});
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');
    const rawPayload = rawBody.toString('utf8');
    const signature = req.get('x-paystack-signature');
    const validSignature = await (0, paystack_js_1.verifyPaystackWebhookSignature)(rawBody, signature);
    if (!validSignature) {
        throw new errorHandler_js_1.AppError('Invalid Paystack webhook signature', 401);
    }
    let payload;
    try {
        payload = JSON.parse(rawPayload);
    }
    catch {
        throw new errorHandler_js_1.AppError('Invalid webhook payload', 400);
    }
    const eventName = String(payload?.event || 'unknown');
    const transferCode = payload?.data?.transfer_code ? String(payload.data.transfer_code) : null;
    const reference = payload?.data?.reference ? String(payload.data.reference) : null;
    const baseKey = `${eventName}:${transferCode || ''}:${reference || ''}:${rawPayload.slice(0, 512)}`;
    const dedupeKey = (0, crypto_1.createHash)('sha256').update(baseKey).digest('hex');
    const duplicate = await db.paystackWebhookEvent.findUnique({
        where: { dedupeKey },
        select: { id: true },
    });
    if (duplicate) {
        return res.json({ received: true, duplicate: true });
    }
    const webhookLog = await db.paystackWebhookEvent.create({
        data: {
            dedupeKey,
            event: eventName,
            reference,
            transferCode,
            payload: rawPayload.slice(0, 100000),
        },
    });
    if (eventName.toLowerCase().startsWith('transfer.')) {
        await (0, payoutAutomation_js_1.reconcilePaystackTransfer)({
            eventName,
            payload,
            rawPayload,
        });
    }
    await db.paystackWebhookEvent.update({
        where: { id: webhookLog.id },
        data: { processedAt: new Date() },
    });
    res.json({ received: true });
}));
exports.default = router;
//# sourceMappingURL=paystack-webhooks.js.map