"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hubtelAdapter = void 0;
const crypto_1 = require("crypto");
const errorHandler_js_1 = require("../../middleware/errorHandler.js");
const DEFAULT_CONFIG = {
    verifyMethod: 'GET',
    verifyReferenceParam: 'reference',
    referencePath: 'data.reference',
    providerTransactionIdPath: 'data.transactionId',
    redirectUrlPath: 'data.checkoutUrl',
    statusPath: 'data.status',
    amountPath: 'data.amount',
    currencyPath: 'data.currency',
    eventTypePath: 'event',
    eventIdPath: 'id',
    webhookReferencePath: 'data.reference',
    webhookProviderTransactionIdPath: 'data.transactionId',
    signatureHeader: 'x-hubtel-signature',
    statusSuccessValues: ['SUCCESS', 'PAID', 'COMPLETED'],
    statusPendingValues: ['PENDING', 'PROCESSING', 'INITIATED'],
};
const parseConfig = (gatewayConfig) => {
    try {
        const parsed = gatewayConfig.hubtelConfigJson
            ? JSON.parse(gatewayConfig.hubtelConfigJson)
            : {};
        return { ...DEFAULT_CONFIG, ...parsed };
    }
    catch {
        return { ...DEFAULT_CONFIG };
    }
};
const deepGet = (obj, path) => {
    if (!obj || !path)
        return undefined;
    return path.split('.').reduce((acc, key) => {
        if (acc && typeof acc === 'object' && key in acc) {
            return acc[key];
        }
        return undefined;
    }, obj);
};
const normalizeStatus = (raw, config) => {
    const value = String(raw || '').toUpperCase();
    const success = new Set((config.statusSuccessValues || DEFAULT_CONFIG.statusSuccessValues).map((item) => item.toUpperCase()));
    const pending = new Set((config.statusPendingValues || DEFAULT_CONFIG.statusPendingValues).map((item) => item.toUpperCase()));
    if (success.has(value))
        return 'SUCCEEDED';
    if (pending.has(value))
        return 'PENDING';
    return 'FAILED';
};
const baseAuthHeader = (gatewayConfig) => {
    const clientId = String(gatewayConfig.hubtelClientId || '').trim();
    const clientSecret = String(gatewayConfig.hubtelClientSecret || '').trim();
    if (!clientId || !clientSecret) {
        throw new errorHandler_js_1.AppError('Hubtel gateway is missing client credentials', 400);
    }
    return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
};
const initializeHubtel = async (intent, gatewayConfig) => {
    const config = parseConfig(gatewayConfig);
    if (!config.initializeUrl) {
        throw new errorHandler_js_1.AppError('Hubtel initialize URL is not configured', 400);
    }
    const reference = `pi_${intent.id}`;
    const body = {
        amount: intent.amount,
        currency: intent.currency,
        purpose: intent.purpose,
        paymentIntentId: intent.id,
        eventId: intent.eventId,
        reference,
        ...(config.initializePayloadDefaults || {}),
    };
    const response = await fetch(config.initializeUrl, {
        method: 'POST',
        headers: {
            Authorization: baseAuthHeader(gatewayConfig),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const payload = (await response.json());
    if (!response.ok) {
        throw new errorHandler_js_1.AppError(String(deepGet(payload, 'message') || 'Hubtel initialization failed'), 400);
    }
    const gatewayReference = String(deepGet(payload, config.referencePath || DEFAULT_CONFIG.referencePath) || reference);
    const redirectUrl = String(deepGet(payload, config.redirectUrlPath || DEFAULT_CONFIG.redirectUrlPath) || '').trim();
    return {
        gatewayReference,
        nextAction: {
            type: redirectUrl ? 'REDIRECT' : 'NONE',
            url: redirectUrl || undefined,
            reference: gatewayReference,
            payload: payload,
        },
        raw: payload,
    };
};
const verifyHubtel = async (reference, gatewayConfig) => {
    const config = parseConfig(gatewayConfig);
    if (!config.verifyUrl) {
        throw new errorHandler_js_1.AppError('Hubtel verify URL is not configured', 400);
    }
    const method = (config.verifyMethod || DEFAULT_CONFIG.verifyMethod).toUpperCase();
    const verifyReferenceParam = config.verifyReferenceParam || DEFAULT_CONFIG.verifyReferenceParam;
    const url = method === 'GET'
        ? `${config.verifyUrl}${config.verifyUrl.includes('?') ? '&' : '?'}${encodeURIComponent(verifyReferenceParam)}=${encodeURIComponent(reference)}`
        : config.verifyUrl;
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: baseAuthHeader(gatewayConfig),
            'Content-Type': 'application/json',
        },
        body: method === 'POST' ? JSON.stringify({ [verifyReferenceParam]: reference }) : undefined,
    });
    const payload = (await response.json());
    if (!response.ok) {
        throw new errorHandler_js_1.AppError(String(deepGet(payload, 'message') || 'Hubtel verification failed'), 400);
    }
    const status = normalizeStatus(deepGet(payload, config.statusPath || DEFAULT_CONFIG.statusPath), config);
    const gatewayReference = String(deepGet(payload, config.referencePath || DEFAULT_CONFIG.referencePath) || reference);
    const providerTransactionId = String(deepGet(payload, config.providerTransactionIdPath || DEFAULT_CONFIG.providerTransactionIdPath) || gatewayReference);
    return {
        status,
        gatewayReference,
        providerTransactionId,
        amount: Number(deepGet(payload, config.amountPath || DEFAULT_CONFIG.amountPath) || 0) || undefined,
        currency: String(deepGet(payload, config.currencyPath || DEFAULT_CONFIG.currencyPath) || '').toUpperCase() || undefined,
        raw: payload,
    };
};
const handleHubtelWebhook = async (payload, gatewayConfig) => {
    const config = parseConfig(gatewayConfig);
    const eventType = String(deepGet(payload, config.eventTypePath || DEFAULT_CONFIG.eventTypePath) || 'hubtel.event');
    const eventId = String(deepGet(payload, config.eventIdPath || DEFAULT_CONFIG.eventIdPath) || '');
    const gatewayReference = String(deepGet(payload, config.webhookReferencePath || DEFAULT_CONFIG.webhookReferencePath) || '');
    const providerTransactionId = String(deepGet(payload, config.webhookProviderTransactionIdPath || DEFAULT_CONFIG.webhookProviderTransactionIdPath) ||
        gatewayReference);
    const status = normalizeStatus(deepGet(payload, config.statusPath || DEFAULT_CONFIG.statusPath), config);
    const rawKey = JSON.stringify(payload || {});
    const fallbackEventId = (0, crypto_1.createHash)('sha256').update(rawKey).digest('hex');
    return {
        eventType,
        eventKey: `${eventType}:${eventId || providerTransactionId || gatewayReference || fallbackEventId}`,
        status: status === 'PENDING' ? 'PENDING' : status,
        gatewayReference: gatewayReference || undefined,
        providerTransactionId: providerTransactionId || undefined,
        amount: Number(deepGet(payload, config.amountPath || DEFAULT_CONFIG.amountPath) || 0) || undefined,
        currency: String(deepGet(payload, config.currencyPath || DEFAULT_CONFIG.currencyPath) || '').toUpperCase() || undefined,
        raw: payload,
    };
};
exports.hubtelAdapter = {
    gateway: 'hubtel',
    initializePayment: initializeHubtel,
    verifyTransaction: verifyHubtel,
    handleWebhook: handleHubtelWebhook,
};
//# sourceMappingURL=hubtelAdapter.js.map