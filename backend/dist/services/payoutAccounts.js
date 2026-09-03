"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayoutAccountGateways = exports.getPayoutAccountProvider = void 0;
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const paystack_js_1 = require("./paystack.js");
const paystackProvider = {
    gateway: 'paystack',
    supportsAccountLookup: true,
    // Ghana has always been the default market for this form.
    listBanks: ({ country, currency }) => (0, paystack_js_1.getPaystackBanks)({ country: country || 'ghana', currency }),
    resolveAccount: async ({ accountNumber, bankCode }) => {
        const resolved = await (0, paystack_js_1.resolvePaystackAccount)(accountNumber, bankCode);
        return {
            accountName: resolved.account_name,
            accountNumber: resolved.account_number || accountNumber,
            bankName: resolved.bank_name || null,
        };
    },
};
/**
 * Stripe verifies payout accounts through Connect onboarding rather than a
 * lookup call, so it advertises no account lookup. Wiring Connect later means
 * filling these in; nothing else in the wallet form has to change.
 */
const stripeProvider = {
    gateway: 'stripe',
    supportsAccountLookup: false,
    unsupportedReason: 'Stripe confirms payout accounts during Connect onboarding, not from a bank lookup.',
    listBanks: async () => [],
    resolveAccount: async () => {
        throw new errorHandler_js_1.AppError('Stripe payout accounts are confirmed through Connect onboarding, not a bank lookup.', 400);
    },
};
const PROVIDERS = {
    paystack: paystackProvider,
    stripe: stripeProvider,
};
const getPayoutAccountProvider = (gateway) => {
    const normalized = String(gateway || '').trim().toLowerCase();
    const provider = PROVIDERS[normalized];
    if (!provider) {
        throw new errorHandler_js_1.AppError(`${gateway} does not support automatic payout accounts yet`, 400);
    }
    return provider;
};
exports.getPayoutAccountProvider = getPayoutAccountProvider;
const listPayoutAccountGateways = () => Object.values(PROVIDERS).map((provider) => ({
    gateway: provider.gateway,
    supportsAccountLookup: provider.supportsAccountLookup,
    unsupportedReason: provider.unsupportedReason || null,
}));
exports.listPayoutAccountGateways = listPayoutAccountGateways;
//# sourceMappingURL=payoutAccounts.js.map