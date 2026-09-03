"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeAdapter = void 0;
const errorHandler_js_1 = require("../../middleware/errorHandler.js");
const STRIPE_BASE_URL = 'https://api.stripe.com/v1';
const resolveSecret = (gatewayConfig) => {
    const secret = String(gatewayConfig.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '').trim();
    if (!secret)
        throw new errorHandler_js_1.AppError('Stripe gateway is missing secret key', 400);
    return secret;
};
const toFormBody = (pairs) => {
    const params = new URLSearchParams();
    Object.entries(pairs).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') {
            params.set(key, String(value));
        }
    });
    return params;
};
/**
 * Stripe splits a Checkout charge with `transfer_data[destination]` (the
 * connected account) plus `application_fee_amount` (the platform's cut in
 * minor units). `ownerAmount` already has platform and processing fees
 * withheld, so the application fee is the rest of the charge — the same
 * arithmetic the Paystack adapter does with `transaction_charge`.
 */
const buildSplitFields = (intent, amountMinor) => {
    const split = intent.split;
    if (!split || split.gateway !== 'stripe' || !split.destinationAccountId)
        return {};
    const ownerMinor = Math.round(split.ownerAmount * 100);
    if (!Number.isFinite(ownerMinor) || ownerMinor <= 0)
        return {};
    const applicationFeeMinor = Math.max(0, amountMinor - Math.min(ownerMinor, amountMinor));
    return {
        'payment_intent_data[transfer_data][destination]': split.destinationAccountId,
        'payment_intent_data[application_fee_amount]': applicationFeeMinor,
    };
};
const initializeStripe = async (intent, gatewayConfig) => {
    const secret = resolveSecret(gatewayConfig);
    // Same precedence as Paystack: the intent picks its own return target.
    const requestedCallback = String((intent.metadata || {}).callbackUrl || '').trim();
    const successUrl = requestedCallback ||
        String(gatewayConfig.successUrl || process.env.FRONTEND_URL || '').trim() ||
        'https://eventpeepo.com';
    const cancelUrl = String((intent.metadata || {}).cancelUrl || gatewayConfig.cancelUrl || successUrl).trim();
    const amountMinor = Math.round(intent.amount * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
        throw new errorHandler_js_1.AppError('Invalid amount for Stripe initialization', 400);
    }
    const body = toFormBody({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: intent.id,
        'line_items[0][price_data][currency]': intent.currency.toLowerCase(),
        'line_items[0][price_data][product_data][name]': `EventPeepo ${intent.purpose} payment`,
        'line_items[0][price_data][unit_amount]': amountMinor,
        'line_items[0][quantity]': 1,
        'metadata[paymentIntentId]': intent.id,
        'metadata[eventId]': intent.eventId,
        'metadata[purpose]': intent.purpose,
        ...buildSplitFields(intent, amountMinor),
    });
    const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
    });
    const payload = (await response.json());
    if (!response.ok || !payload?.id || !payload?.url) {
        throw new errorHandler_js_1.AppError(payload?.error?.message || 'Failed to initialize Stripe checkout', 400);
    }
    return {
        gatewayReference: payload.id,
        nextAction: {
            type: 'REDIRECT',
            url: payload.url,
            reference: payload.id,
            payload: {
                checkoutSessionId: payload.id,
                paymentIntentId: payload.payment_intent || null,
            },
        },
        raw: payload,
    };
};
const verifyStripe = async (reference, gatewayConfig) => {
    const secret = resolveSecret(gatewayConfig);
    const response = await fetch(`${STRIPE_BASE_URL}/checkout/sessions/${encodeURIComponent(reference)}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${secret}`,
        },
    });
    const payload = (await response.json());
    if (!response.ok || !payload?.id) {
        throw new errorHandler_js_1.AppError(payload?.error?.message || 'Failed to verify Stripe checkout session', 400);
    }
    const normalizedStatus = String(payload.payment_status || '').toLowerCase();
    const status = normalizedStatus === 'paid'
        ? 'SUCCEEDED'
        : normalizedStatus === 'unpaid'
            ? 'FAILED'
            : 'PENDING';
    return {
        status,
        gatewayReference: payload.id,
        providerTransactionId: String(payload.payment_intent || payload.id),
        amount: typeof payload.amount_total === 'number' ? payload.amount_total / 100 : undefined,
        currency: payload.currency ? payload.currency.toUpperCase() : undefined,
        raw: payload,
    };
};
const handleStripeWebhook = async (payload, _gatewayConfig) => {
    const body = payload;
    const eventType = String(body?.type || 'unknown');
    const object = body?.data?.object || {};
    const gatewayReference = object.id ? String(object.id) : undefined;
    const providerTransactionId = object.payment_intent
        ? String(object.payment_intent)
        : gatewayReference;
    const status = eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded'
        ? 'SUCCEEDED'
        : eventType === 'checkout.session.expired' || eventType === 'payment_intent.payment_failed'
            ? 'FAILED'
            : 'IGNORED';
    const amount = typeof object.amount_total === 'number'
        ? object.amount_total / 100
        : typeof object.amount_received === 'number'
            ? object.amount_received / 100
            : undefined;
    return {
        eventType,
        eventKey: `${eventType}:${body?.id || providerTransactionId || gatewayReference || 'unknown'}`,
        status,
        gatewayReference,
        providerTransactionId,
        amount,
        currency: object.currency ? String(object.currency).toUpperCase() : undefined,
        raw: payload,
    };
};
exports.stripeAdapter = {
    gateway: 'stripe',
    initializePayment: initializeStripe,
    verifyTransaction: verifyStripe,
    handleWebhook: handleStripeWebhook,
};
//# sourceMappingURL=stripeAdapter.js.map