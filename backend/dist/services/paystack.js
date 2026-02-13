"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePaystackSubaccount = exports.createPaystackSubaccount = exports.resolvePaystackAccount = exports.getPaystackBanks = void 0;
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const PAYSTACK_BASE_URL = process.env.PAYSTACK_BASE_URL || 'https://api.paystack.co';
const getConfiguredPaystackSecret = async () => {
    const envSecret = process.env.PAYSTACK_SECRET_KEY?.trim();
    if (envSecret)
        return envSecret;
    const gateway = await prisma_js_1.default.paymentGateway.findFirst({
        where: {
            gateway: 'paystack',
            isActive: true,
            paystackSecretKey: { not: null },
        },
        orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
        select: { paystackSecretKey: true },
    });
    const gatewaySecret = gateway?.paystackSecretKey?.trim();
    if (gatewaySecret)
        return gatewaySecret;
    throw new errorHandler_js_1.AppError('Paystack is not configured yet. Ask admin to set Paystack keys first.', 400);
};
const paystackRequest = async (path, options = {}, secretKey) => {
    const resolvedSecret = secretKey || (await getConfiguredPaystackSecret());
    const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${resolvedSecret}`,
            'Content-Type': 'application/json',
            ...(options.headers || {}),
        },
    });
    const payload = (await response.json());
    if (!response.ok || !payload?.status) {
        const message = payload?.message || `Paystack request failed (${response.status})`;
        throw new errorHandler_js_1.AppError(message, 400);
    }
    return payload.data;
};
const getPaystackBanks = async (params) => {
    const query = new URLSearchParams();
    if (params?.country)
        query.set('country', params.country);
    if (params?.currency)
        query.set('currency', params.currency);
    query.set('enabled_for_verification', 'true');
    query.set('perPage', '200');
    const banks = await paystackRequest(`/bank?${query.toString()}`);
    return banks
        .filter((bank) => bank.active !== false)
        .map((bank) => ({
        code: bank.code,
        name: bank.name,
        currency: bank.currency,
        country: bank.country,
    }));
};
exports.getPaystackBanks = getPaystackBanks;
const resolvePaystackAccount = async (accountNumber, bankCode) => {
    const query = new URLSearchParams({
        account_number: accountNumber,
        bank_code: bankCode,
    });
    return paystackRequest(`/bank/resolve?${query.toString()}`);
};
exports.resolvePaystackAccount = resolvePaystackAccount;
const createPaystackSubaccount = async (payload) => {
    return paystackRequest('/subaccount', {
        method: 'POST',
        body: JSON.stringify({
            business_name: payload.businessName,
            settlement_bank: payload.bankCode,
            account_number: payload.accountNumber,
            percentage_charge: payload.percentageCharge ?? 0,
            primary_contact_name: payload.primaryContactName,
            primary_contact_email: payload.primaryContactEmail,
            description: payload.description,
        }),
    });
};
exports.createPaystackSubaccount = createPaystackSubaccount;
const updatePaystackSubaccount = async (subaccountCode, payload) => {
    return paystackRequest(`/subaccount/${encodeURIComponent(subaccountCode)}`, {
        method: 'PUT',
        body: JSON.stringify({
            business_name: payload.businessName,
            settlement_bank: payload.bankCode,
            account_number: payload.accountNumber,
            percentage_charge: payload.percentageCharge ?? 0,
            primary_contact_name: payload.primaryContactName,
            primary_contact_email: payload.primaryContactEmail,
            description: payload.description,
        }),
    });
};
exports.updatePaystackSubaccount = updatePaystackSubaccount;
//# sourceMappingURL=paystack.js.map