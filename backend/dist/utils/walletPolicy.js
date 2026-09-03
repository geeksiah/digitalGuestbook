"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectedAccountIdForWallet = exports.resolveRoutingForMethod = exports.filterEventGatewaysForOwner = exports.resolveOwnerWalletState = exports.getAvailableWalletTypes = exports.isGatewaySupportedInCountry = exports.isGatewayConfigured = exports.isManualWalletType = exports.walletTypeForGateway = exports.normalizeWalletType = void 0;
const MANUAL_TYPES = new Set(['manual', 'offline']);
const GATEWAY_TO_WALLET_TYPE = {
    stripe: 'stripe',
    paystack: 'paystack',
    paypal: 'paypal',
    flutterwave: 'flutterwave',
    hubtel: 'hubtel',
};
const GATEWAY_COVERAGE_RULES = {
    stripe: 'GLOBAL',
    paypal: [
        'US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE', 'SE', 'NO', 'DK',
        'PL', 'PT', 'AT', 'CH', 'CZ', 'HU', 'RO', 'SG', 'JP', 'HK', 'AE', 'IL', 'MX', 'BR',
    ],
    paystack: ['NG', 'GH', 'ZA', 'KE', 'CI', 'EG'],
    flutterwave: ['NG', 'GH', 'KE', 'UG', 'RW', 'TZ', 'ZA'],
    hubtel: ['GH'],
    mtn_momo: ['GH', 'UG', 'CM', 'CI', 'RW', 'ZM', 'BJ', 'GN'],
    telecel_cash: ['GH'],
    airteltigo_cash: ['GH'],
};
const normalizeCountry = (countryCode) => String(countryCode || '').trim().toUpperCase() || null;
const normalizeWalletType = (walletType) => String(walletType || '').trim().toLowerCase();
exports.normalizeWalletType = normalizeWalletType;
const walletTypeForGateway = (gateway) => GATEWAY_TO_WALLET_TYPE[String(gateway || '').trim().toLowerCase()] || null;
exports.walletTypeForGateway = walletTypeForGateway;
const isManualWalletType = (walletType) => MANUAL_TYPES.has((0, exports.normalizeWalletType)(walletType));
exports.isManualWalletType = isManualWalletType;
const isGatewayConfigured = (gateway) => {
    const type = String(gateway?.gateway || '').toLowerCase();
    if (type === 'stripe')
        return Boolean(gateway?.stripePublicKey && gateway?.stripeSecretKey);
    if (type === 'paystack')
        return Boolean(gateway?.paystackPublicKey && gateway?.paystackSecretKey);
    if (type === 'flutterwave')
        return Boolean(gateway?.flutterwavePublicKey && gateway?.flutterwaveSecretKey);
    if (type === 'hubtel')
        return Boolean(gateway?.hubtelClientId && gateway?.hubtelClientSecret);
    if (type === 'paypal')
        return Boolean(gateway?.customGatewayApiKey || gateway?.customGatewayApiSecret || gateway?.customGatewayApiUrl);
    if (type === 'mtn_momo')
        return Boolean(gateway?.mtnMomoApiKey && gateway?.mtnMomoApiSecret && gateway?.mtnMomoSubscriptionKey);
    if (type === 'telecel_cash')
        return Boolean(gateway?.telecelCashApiKey && gateway?.telecelCashApiSecret && gateway?.telecelCashMerchantId);
    if (type === 'airteltigo_cash')
        return Boolean(gateway?.airteltigoCashApiKey && gateway?.airteltigoCashApiSecret && gateway?.airteltigoCashMerchantId);
    if (type === 'custom')
        return Boolean(gateway?.customGatewayApiUrl && (gateway?.customGatewayApiKey || gateway?.customGatewayApiSecret));
    return false;
};
exports.isGatewayConfigured = isGatewayConfigured;
const isGatewaySupportedInCountry = (gatewayType, countryCode) => {
    const normalizedType = String(gatewayType || '').toLowerCase();
    const rule = GATEWAY_COVERAGE_RULES[normalizedType];
    if (!rule)
        return true;
    if (rule === 'GLOBAL')
        return true;
    const normalizedCountry = normalizeCountry(countryCode);
    if (!normalizedCountry)
        return false;
    return rule.includes(normalizedCountry);
};
exports.isGatewaySupportedInCountry = isGatewaySupportedInCountry;
const getAvailableWalletTypes = (params) => {
    const result = new Set(['manual', 'offline']);
    for (const gateway of params.paymentGateways) {
        const gatewayType = String(gateway?.gateway || '').toLowerCase();
        const walletType = (0, exports.walletTypeForGateway)(gatewayType);
        if (!walletType)
            continue;
        if (!(0, exports.isGatewayConfigured)(gateway))
            continue;
        if (!(0, exports.isGatewaySupportedInCountry)(gatewayType, params.countryCode))
            continue;
        result.add(walletType);
    }
    return Array.from(result);
};
exports.getAvailableWalletTypes = getAvailableWalletTypes;
const resolveOwnerWalletState = (wallets = []) => {
    const activeWallets = wallets.filter((wallet) => wallet.isActive);
    const manualWallet = activeWallets.find((wallet) => (0, exports.isManualWalletType)(wallet.walletType)) || null;
    const automatedWallets = activeWallets.filter((wallet) => !(0, exports.isManualWalletType)(wallet.walletType));
    const verifiedAutomatedWallets = automatedWallets.filter((wallet) => wallet.isVerified);
    const byType = new Map();
    for (const wallet of verifiedAutomatedWallets) {
        const walletType = (0, exports.normalizeWalletType)(wallet.walletType);
        if (!byType.has(walletType))
            byType.set(walletType, wallet);
    }
    const mode = manualWallet
        ? 'MANUAL_EXPLICIT'
        : verifiedAutomatedWallets.length > 0
            ? 'AUTOMATED'
            : 'MANUAL_FALLBACK';
    return {
        mode,
        activeWallets,
        manualWallet,
        automatedWallets,
        verifiedAutomatedWallets,
        walletByType: byType,
    };
};
exports.resolveOwnerWalletState = resolveOwnerWalletState;
const filterEventGatewaysForOwner = (params) => {
    if (params.walletState.mode !== 'AUTOMATED') {
        return params.eventGateways;
    }
    return params.eventGateways.filter((eventGateway) => {
        const gatewayType = String(eventGateway?.paymentGateway?.gateway || eventGateway?.gateway || '').toLowerCase();
        const walletType = (0, exports.walletTypeForGateway)(gatewayType);
        if (!walletType)
            return false;
        return params.walletState.walletByType.has(walletType);
    });
};
exports.filterEventGatewaysForOwner = filterEventGatewaysForOwner;
const resolveRoutingForMethod = (params) => {
    const method = String(params.paymentMethod || '').trim().toLowerCase();
    const walletType = (0, exports.walletTypeForGateway)(method);
    if (params.walletState.mode === 'AUTOMATED' && walletType) {
        const matchedWallet = params.walletState.walletByType.get(walletType) || null;
        if (matchedWallet) {
            return {
                payoutRouting: 'OWNER_AUTOMATED',
                wallet: matchedWallet,
            };
        }
    }
    return {
        payoutRouting: 'ADMIN_MANUAL',
        wallet: null,
    };
};
exports.resolveRoutingForMethod = resolveRoutingForMethod;
/**
 * The provider-side account id that receives a split for this wallet. Each
 * gateway stores it in a different column, so callers building a split ask
 * here rather than reaching for a provider-specific field.
 */
const connectedAccountIdForWallet = (wallet, gateway) => {
    if (!wallet)
        return null;
    const type = (0, exports.normalizeWalletType)(gateway);
    if (type === 'paystack')
        return wallet.paystackSubaccount || null;
    // Stripe (and any future connect-style gateway) keeps the connected account
    // id in the generic column.
    return wallet.providerAccountId || null;
};
exports.connectedAccountIdForWallet = connectedAccountIdForWallet;
//# sourceMappingURL=walletPolicy.js.map