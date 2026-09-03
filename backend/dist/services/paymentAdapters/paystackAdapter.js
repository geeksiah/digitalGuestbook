"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paystackAdapter = void 0;
const errorHandler_js_1 = require("../../middleware/errorHandler.js");
const paystack_js_1 = require("../paystack.js");
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const buildCallbackUrl = (gatewayConfig) => {
    const explicit = String(gatewayConfig.successUrl || '').trim();
    if (explicit)
        return explicit;
    const base = String(process.env.FRONTEND_URL || process.env.SITE_URL || '').trim().replace(/\/+$/, '');
    return base || undefined;
};
const resolveSecret = (gatewayConfig) => {
    const secret = String(gatewayConfig.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY || '').trim();
    if (!secret) {
        throw new errorHandler_js_1.AppError('Paystack gateway is missing secret key', 400);
    }
    return secret;
};
/**
 * Paystack splits a charge by naming a subaccount and a `transaction_charge`:
 * the flat amount (in minor units) kept by the main account, with the
 * remainder settling to the subaccount. Because `ownerAmount` already has the
 * platform and processing fees withheld, the charge is simply the difference.
 */
const buildSplitFields = (intent) => {
    const split = intent.split;
    if (!split || split.gateway !== 'paystack' || !split.destinationAccountId)
        return {};
    const totalMinor = Math.round(intent.amount * 100);
    const ownerMinor = Math.round(split.ownerAmount * 100);
    if (!Number.isFinite(ownerMinor) || ownerMinor <= 0)
        return {};
    // Never let rounding hand the subaccount more than was charged.
    const platformMinor = Math.max(0, totalMinor - Math.min(ownerMinor, totalMinor));
    return {
        subaccount: split.destinationAccountId,
        transaction_charge: platformMinor,
        // The platform account carries Paystack's fee; the owner share was
        // already reduced by the processing estimate withheld at checkout.
        bearer: split.bearer === 'destination' ? 'subaccount' : 'account',
    };
};
const initializePaystack = async (intent, gatewayConfig) => {
    const secret = resolveSecret(gatewayConfig);
    const callbackUrl = buildCallbackUrl(gatewayConfig);
    const metadata = intent.metadata || {};
    const email = String(metadata.email || metadata.guestEmail || metadata.customerEmail || '').trim() ||
        'guest@eventpeepo.com';
    const reference = `pi_${intent.id}`;
    const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            amount: Math.round(intent.amount * 100),
            currency: intent.currency,
            reference,
            callback_url: callbackUrl,
            ...buildSplitFields(intent),
            metadata: {
                paymentIntentId: intent.id,
                eventId: intent.eventId,
                purpose: intent.purpose,
                ...metadata,
            },
        }),
    });
    const payload = (await response.json());
    if (!response.ok || !payload?.status || !payload?.data?.authorization_url) {
        throw new errorHandler_js_1.AppError(payload?.message || 'Failed to initialize Paystack transaction', 400);
    }
    return {
        gatewayReference: String(payload.data.reference || reference),
        nextAction: {
            type: 'REDIRECT',
            url: payload.data.authorization_url,
            reference: String(payload.data.reference || reference),
            payload: {
                accessCode: payload.data.access_code || null,
            },
        },
        raw: payload,
    };
};
const verifyPaystack = async (reference, _gatewayConfig) => {
    const verified = await (0, paystack_js_1.verifyPaystackTransaction)(reference);
    const status = String(verified.status || '').toLowerCase() === 'success' ? 'SUCCEEDED' : 'FAILED';
    const providerId = String(verified.id || verified.reference || reference);
    return {
        status,
        gatewayReference: String(verified.reference || reference),
        providerTransactionId: providerId,
        amount: Number(verified.amount || 0) / 100,
        currency: String(verified.currency || '').toUpperCase() || undefined,
        raw: verified,
    };
};
const paystackStatusFromEvent = (eventType) => {
    const normalized = eventType.toLowerCase();
    if (normalized === 'charge.success')
        return 'SUCCEEDED';
    if (normalized === 'charge.failed')
        return 'FAILED';
    return 'IGNORED';
};
const handlePaystackWebhook = async (payload, _gatewayConfig) => {
    const body = payload;
    const eventType = String(body?.event || 'unknown');
    const gatewayReference = body?.data?.reference ? String(body.data.reference) : undefined;
    const providerTransactionId = body?.data?.id
        ? String(body.data.id)
        : gatewayReference;
    return {
        eventType,
        eventKey: `${eventType}:${providerTransactionId || gatewayReference || 'unknown'}`,
        status: paystackStatusFromEvent(eventType),
        gatewayReference,
        providerTransactionId,
        amount: typeof body?.data?.amount === 'number' ? body.data.amount / 100 : undefined,
        currency: body?.data?.currency ? String(body.data.currency).toUpperCase() : undefined,
        raw: payload,
    };
};
exports.paystackAdapter = {
    gateway: 'paystack',
    initializePayment: initializePaystack,
    verifyTransaction: verifyPaystack,
    handleWebhook: handlePaystackWebhook,
};
//# sourceMappingURL=paystackAdapter.js.map