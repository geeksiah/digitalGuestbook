"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = exports.finalizePaymentIntent = exports.callFulfillmentHandler = exports.createTransaction = exports.verifyGatewayTransaction = exports.createPaymentIntent = void 0;
const crypto_1 = require("crypto");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const fees_js_1 = require("../utils/fees.js");
const paymentFulfillment_js_1 = require("./paymentFulfillment.js");
const index_js_1 = require("./paymentAdapters/index.js");
const roundMoney = (value) => Math.round(value * 100) / 100;
const toJsonString = (value) => JSON.stringify(value);
const parseIntentMetadata = (intent) => {
    if (!intent.metadataJson)
        return {};
    try {
        return JSON.parse(intent.metadataJson);
    }
    catch {
        return {};
    }
};
const buildIdempotencyKey = (input, ownerId) => {
    const base = JSON.stringify({
        eventId: input.eventId,
        ownerId,
        purpose: input.purpose,
        amount: roundMoney(input.amount),
        currency: String(input.currency || '').toUpperCase(),
        paymentGatewayId: input.paymentGatewayId,
        metadata: input.metadata || {},
    });
    return (0, crypto_1.createHash)('sha256').update(base).digest('hex');
};
const resolveIntentFromWebhook = async (gateway, normalized) => {
    const byReferenceCandidates = new Set();
    if (normalized.gatewayReference)
        byReferenceCandidates.add(normalized.gatewayReference);
    if (normalized.providerTransactionId)
        byReferenceCandidates.add(normalized.providerTransactionId);
    for (const candidate of byReferenceCandidates) {
        const byReference = await prisma_js_1.default.paymentIntent.findFirst({
            where: {
                gateway,
                OR: [{ gatewayReference: candidate }, { id: candidate.replace(/^pi_/, '') }],
            },
        });
        if (byReference)
            return byReference;
    }
    const raw = (normalized.raw || {});
    let paymentIntentId;
    if (gateway === 'paystack') {
        const data = raw.data;
        const metadata = data?.metadata;
        if (typeof metadata?.paymentIntentId === 'string')
            paymentIntentId = metadata.paymentIntentId;
    }
    if (gateway === 'stripe') {
        const data = raw.data?.object;
        if (typeof data?.client_reference_id === 'string')
            paymentIntentId = data.client_reference_id;
        if (!paymentIntentId && typeof data?.metadata === 'object' && data.metadata) {
            const metadata = data.metadata;
            if (typeof metadata.paymentIntentId === 'string')
                paymentIntentId = metadata.paymentIntentId;
        }
    }
    if (gateway === 'hubtel') {
        if (typeof raw.paymentIntentId === 'string')
            paymentIntentId = raw.paymentIntentId;
        if (!paymentIntentId && typeof raw.data === 'object' && raw.data) {
            const data = raw.data;
            if (typeof data.paymentIntentId === 'string')
                paymentIntentId = data.paymentIntentId;
        }
    }
    if (!paymentIntentId)
        return null;
    return prisma_js_1.default.paymentIntent.findUnique({ where: { id: paymentIntentId } });
};
const resolveGatewayConfig = async (gatewayId) => {
    const gateway = await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            id: gatewayId,
            isActive: true,
        },
    });
    if (!gateway)
        throw new errorHandler_js_1.AppError('Payment gateway is not available', 400);
    return gateway;
};
const resolveGatewayConfigForIntent = async (intent) => {
    const metadata = parseIntentMetadata(intent);
    const paymentGatewayId = typeof metadata.paymentGatewayId === 'string' ? metadata.paymentGatewayId : null;
    if (paymentGatewayId) {
        return resolveGatewayConfig(paymentGatewayId);
    }
    const gateway = await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            gateway: intent.gateway,
            isActive: true,
        },
        orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!gateway) {
        throw new errorHandler_js_1.AppError(`Gateway config for ${intent.gateway} not found`, 400);
    }
    return gateway;
};
const createPaymentIntent = async (input) => {
    const amount = roundMoney(Number(input.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) {
        throw new errorHandler_js_1.AppError('Payment amount must be greater than zero', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: input.eventId },
        select: {
            id: true,
            ownerId: true,
            defaultCurrency: true,
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
            eventPaymentGateways: {
                where: {
                    paymentGatewayId: input.paymentGatewayId,
                    isActive: true,
                    paymentGateway: {
                        isActive: true,
                    },
                },
                include: {
                    paymentGateway: true,
                },
            },
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.ownerId)
        throw new errorHandler_js_1.AppError('Event owner is not configured', 400);
    const eventGateway = event.eventPaymentGateways[0];
    if (!eventGateway)
        throw new errorHandler_js_1.AppError('Selected payment gateway is not enabled for this event', 400);
    const selectedGateway = eventGateway.paymentGateway;
    const gatewayType = String(selectedGateway.gateway || '').toLowerCase();
    const currency = String(input.currency || selectedGateway.currency || event.defaultCurrency || 'USD').toUpperCase();
    const feeConfigEvent = {
        feeOverridesEnabled: event.feeOverridesEnabled,
        platformFeeMode: event.platformFeeMode,
        platformFeePercent: event.platformFeePercent,
        platformFeeFixed: event.platformFeeFixed,
        processingFeePercent: event.processingFeePercent,
        processingFeeFixed: event.processingFeeFixed,
    };
    const isGift = input.purpose === 'GIFT';
    // Tickets and votes add the fees on top of the price, so the organiser
    // receives the full face value. Gifts work the other way round: the guest
    // pays exactly the gift they chose and the fees come out of the cash
    // portion, per the settlement rule in utils/fees.ts.
    let chargeAmount;
    let platformFeeAmount;
    let organizerAmount;
    let processingEstimate;
    let giftSettlement = null;
    if (isGift) {
        const giftDefaults = await (0, fees_js_1.getGiftFeeDefaults)();
        const giftConfig = (0, fees_js_1.resolveGiftFeeConfig)(event, giftDefaults);
        const breakdown = input.giftBreakdown || { packageAmount: 0, cashGiftAmount: amount };
        giftSettlement = (0, fees_js_1.computeGiftSettlement)({
            packageAmount: breakdown.packageAmount,
            cashGiftAmount: breakdown.cashGiftAmount,
            config: giftConfig,
        });
        chargeAmount = amount;
        platformFeeAmount = giftSettlement.platformFeeAmount;
        organizerAmount = giftSettlement.ownerNetAmount;
        processingEstimate = giftSettlement.processingFeeAmount;
    }
    else {
        const fees = await (0, fees_js_1.computeFees)(amount, feeConfigEvent);
        chargeAmount = roundMoney(amount + fees.platformFeeAmount + fees.processingEstimate);
        platformFeeAmount = fees.platformFeeAmount;
        organizerAmount = fees.organizerAmount;
        processingEstimate = fees.processingEstimate;
    }
    // A split is only attempted when the owner has a verified account on the
    // same gateway the guest is paying with and there is something to send.
    const requestedAccount = input.ownerConnectedAccount;
    const split = isGift &&
        organizerAmount > 0 &&
        requestedAccount?.accountId &&
        String(requestedAccount.gateway || '').toLowerCase() === gatewayType
        ? {
            gateway: gatewayType,
            destinationAccountId: requestedAccount.accountId,
            ownerAmount: organizerAmount,
            bearer: 'platform',
        }
        : null;
    const idempotencyKey = input.idempotencyKey || buildIdempotencyKey(input, event.ownerId);
    const metadataPayload = {
        ...(input.metadata || {}),
        paymentGatewayId: selectedGateway.id,
        baseAmount: amount,
        processingEstimate,
        // Frozen at checkout so fulfilment and the ledger agree with what the
        // guest was shown, even if admin edits fee settings in between.
        ...(giftSettlement ? { giftSettlement } : {}),
        ...(split ? { payoutRouting: 'OWNER_AUTOMATED', splitAccountId: split.destinationAccountId } : {}),
    };
    let intent;
    try {
        intent = await prisma_js_1.default.paymentIntent.create({
            data: {
                eventId: event.id,
                ownerId: event.ownerId,
                purpose: input.purpose,
                gateway: gatewayType,
                amount: chargeAmount,
                currency,
                status: 'PENDING',
                platformFeeAmount,
                organizerAmount,
                metadataJson: toJsonString(metadataPayload),
                idempotencyKey,
            },
        });
    }
    catch (error) {
        if (error?.code !== 'P2002')
            throw error;
        const existing = await prisma_js_1.default.paymentIntent.findUnique({
            where: { idempotencyKey },
        });
        if (!existing)
            throw error;
        intent = existing;
    }
    const adapter = (0, index_js_1.getPaymentAdapter)(gatewayType);
    const adapterIntent = {
        id: intent.id,
        eventId: intent.eventId,
        purpose: intent.purpose,
        amount: intent.amount,
        currency: intent.currency,
        metadata: metadataPayload,
        split,
    };
    let nextAction = { type: 'NONE', reference: intent.gatewayReference || undefined };
    if (!intent.gatewayReference || intent.status === 'PENDING') {
        const initialized = await adapter.initializePayment(adapterIntent, selectedGateway);
        intent = await prisma_js_1.default.paymentIntent.update({
            where: { id: intent.id },
            data: {
                status: 'INITIALIZED',
                gatewayReference: initialized.gatewayReference,
            },
        });
        nextAction = initialized.nextAction;
    }
    return { intent, nextAction };
};
exports.createPaymentIntent = createPaymentIntent;
const verifyGatewayTransaction = async (intentId, reference) => {
    const intent = await prisma_js_1.default.paymentIntent.findUnique({ where: { id: intentId } });
    if (!intent)
        throw new errorHandler_js_1.AppError('Payment intent not found', 404);
    const gatewayConfig = await resolveGatewayConfigForIntent(intent);
    const adapter = (0, index_js_1.getPaymentAdapter)(intent.gateway);
    const targetReference = String(reference || intent.gatewayReference || '').trim();
    if (!targetReference)
        throw new errorHandler_js_1.AppError('Payment reference is required for verification', 400);
    const verified = await adapter.verifyTransaction(targetReference, gatewayConfig);
    if (verified.status === 'SUCCEEDED') {
        await (0, exports.finalizePaymentIntent)({
            intentId: intent.id,
            status: 'SUCCEEDED',
            providerTransactionId: verified.providerTransactionId,
            gatewayReference: verified.gatewayReference || targetReference,
        });
    }
    if (verified.status === 'FAILED') {
        await (0, exports.finalizePaymentIntent)({
            intentId: intent.id,
            status: 'FAILED',
            providerTransactionId: verified.providerTransactionId,
            gatewayReference: verified.gatewayReference || targetReference,
        });
    }
    return verified;
};
exports.verifyGatewayTransaction = verifyGatewayTransaction;
const createTransaction = async (intent, providerTransactionId) => {
    const normalizedProviderId = String(providerTransactionId || intent.gatewayReference || (0, crypto_1.randomUUID)()).trim();
    if (!normalizedProviderId) {
        throw new errorHandler_js_1.AppError('Provider transaction id is required', 400);
    }
    try {
        return await prisma_js_1.default.transaction.create({
            data: {
                paymentIntentId: intent.id,
                eventId: intent.eventId,
                ownerId: intent.ownerId,
                gateway: intent.gateway,
                grossAmount: intent.amount,
                platformFeeAmount: intent.platformFeeAmount,
                organizerAmount: intent.organizerAmount,
                currency: intent.currency,
                providerTransactionId: normalizedProviderId,
                status: 'COMPLETED',
            },
        });
    }
    catch (error) {
        if (error?.code !== 'P2002')
            throw error;
        const existingByIntent = await prisma_js_1.default.transaction.findUnique({
            where: { paymentIntentId: intent.id },
        });
        if (existingByIntent)
            return existingByIntent;
        const existingByProvider = await prisma_js_1.default.transaction.findUnique({
            where: { providerTransactionId: normalizedProviderId },
        });
        if (existingByProvider)
            return existingByProvider;
        throw error;
    }
};
exports.createTransaction = createTransaction;
const callFulfillmentHandler = async (intent, tx) => {
    if (intent.purpose === 'TICKET') {
        await (0, paymentFulfillment_js_1.fulfillTicketPurchase)(intent, tx);
        return;
    }
    if (intent.purpose === 'GIFT') {
        await (0, paymentFulfillment_js_1.fulfillGiftPurchase)(intent, tx);
        return;
    }
    if (intent.purpose === 'VOTE') {
        await (0, paymentFulfillment_js_1.fulfillVotePurchase)(intent, tx);
        return;
    }
    if (intent.purpose === 'USSD_CREDITS_TOPUP' || intent.purpose === 'VOTE_PURCHASE') {
        return;
    }
    throw new errorHandler_js_1.AppError(`Unsupported payment intent purpose: ${intent.purpose}`, 400);
};
exports.callFulfillmentHandler = callFulfillmentHandler;
const finalizePaymentIntent = async (params) => {
    const intent = await prisma_js_1.default.paymentIntent.findUnique({
        where: { id: params.intentId },
    });
    if (!intent)
        throw new errorHandler_js_1.AppError('Payment intent not found', 404);
    if (params.status === 'FAILED' || params.status === 'EXPIRED') {
        if (intent.status !== 'SUCCEEDED') {
            const mappedStatus = params.status === 'FAILED' ? 'FAILED' : 'EXPIRED';
            await prisma_js_1.default.paymentIntent.update({
                where: { id: intent.id },
                data: {
                    status: mappedStatus,
                    gatewayReference: params.gatewayReference || intent.gatewayReference,
                },
            });
        }
        await (0, paymentFulfillment_js_1.releaseTicketInventoryHolds)(intent.id, params.status === 'EXPIRED' ? 'EXPIRED' : 'RELEASED');
        return { intent, transaction: null };
    }
    const updatedIntent = await prisma_js_1.default.paymentIntent.update({
        where: { id: intent.id },
        data: {
            status: 'SUCCEEDED',
            gatewayReference: params.gatewayReference || intent.gatewayReference,
        },
    });
    const transaction = await (0, exports.createTransaction)(updatedIntent, params.providerTransactionId || params.gatewayReference || updatedIntent.gatewayReference || updatedIntent.id);
    await (0, exports.callFulfillmentHandler)(updatedIntent, transaction);
    return { intent: updatedIntent, transaction };
};
exports.finalizePaymentIntent = finalizePaymentIntent;
const handleWebhook = async (input) => {
    const gateway = String(input.gateway || '').toLowerCase();
    const adapter = (0, index_js_1.getPaymentAdapter)(gateway);
    const gatewayConfig = (await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            gateway,
            isActive: true,
        },
        orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    }));
    if (!gatewayConfig) {
        throw new errorHandler_js_1.AppError(`No active ${gateway} gateway config found`, 400);
    }
    const normalized = await adapter.handleWebhook(input.payload, gatewayConfig);
    const payloadString = input.rawPayload || JSON.stringify(input.payload || {});
    const existingWebhook = await prisma_js_1.default.paymentWebhookEvent.findUnique({
        where: { eventKey: normalized.eventKey },
    });
    if (existingWebhook) {
        return {
            received: true,
            duplicate: true,
            status: normalized.status,
        };
    }
    const resolvedIntent = await resolveIntentFromWebhook(gateway, normalized);
    await prisma_js_1.default.paymentWebhookEvent.create({
        data: {
            eventId: resolvedIntent?.eventId || null,
            gateway,
            eventType: normalized.eventType,
            eventKey: normalized.eventKey,
            payload: payloadString.slice(0, 100000),
            processedAt: new Date(),
        },
    });
    if (!resolvedIntent || normalized.status === 'IGNORED') {
        return {
            received: true,
            status: normalized.status,
            paymentIntentId: resolvedIntent?.id || null,
        };
    }
    if (normalized.status === 'SUCCEEDED') {
        await (0, exports.finalizePaymentIntent)({
            intentId: resolvedIntent.id,
            status: 'SUCCEEDED',
            providerTransactionId: normalized.providerTransactionId || normalized.gatewayReference || resolvedIntent.gatewayReference || resolvedIntent.id,
            gatewayReference: normalized.gatewayReference || resolvedIntent.gatewayReference || undefined,
        });
    }
    else if (normalized.status === 'FAILED') {
        await (0, exports.finalizePaymentIntent)({
            intentId: resolvedIntent.id,
            status: 'FAILED',
            providerTransactionId: normalized.providerTransactionId,
            gatewayReference: normalized.gatewayReference || resolvedIntent.gatewayReference || undefined,
        });
    }
    return {
        received: true,
        status: normalized.status,
        paymentIntentId: resolvedIntent.id,
    };
};
exports.handleWebhook = handleWebhook;
//# sourceMappingURL=paymentCore.js.map