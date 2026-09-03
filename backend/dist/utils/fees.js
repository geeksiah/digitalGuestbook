"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGiftSettlement = exports.getGiftFeeDefaults = exports.resolveGiftFeeConfig = exports.defaultFeeConfig = exports.computeFees = exports.resolveEventFeeConfig = exports.getSystemFeeDefaults = void 0;
const prisma_js_1 = __importDefault(require("./prisma.js"));
const FALLBACK_FEE_CONFIG = {
    platformFeeMode: 'PERCENTAGE',
    platformFeePercent: 5,
    platformFeeFixed: 0,
    processingFeePercent: 2.9,
    processingFeeFixed: 0.3,
};
const toFeeMode = (value) => String(value || 'PERCENTAGE').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
const toNonNegative = (value) => Math.max(0, Number(value || 0));
const normalizeFeeConfig = (raw) => ({
    platformFeeMode: toFeeMode(raw?.platformFeeMode),
    platformFeePercent: toNonNegative(raw?.platformFeePercent),
    platformFeeFixed: toNonNegative(raw?.platformFeeFixed),
    processingFeePercent: toNonNegative(raw?.processingFeePercent),
    processingFeeFixed: toNonNegative(raw?.processingFeeFixed),
});
const getSystemFeeDefaults = async () => {
    const settings = await prisma_js_1.default.systemSettings.findUnique({
        where: { id: 'default' },
    });
    return normalizeFeeConfig(settings || FALLBACK_FEE_CONFIG);
};
exports.getSystemFeeDefaults = getSystemFeeDefaults;
const resolveEventFeeConfig = (event, defaults) => {
    // If undefined (older payloads), keep previous behavior: use event-level values.
    const overridesEnabled = event.feeOverridesEnabled !== false;
    if (!overridesEnabled)
        return defaults;
    return normalizeFeeConfig({
        platformFeeMode: event.platformFeeMode,
        platformFeePercent: event.platformFeePercent,
        platformFeeFixed: event.platformFeeFixed,
        processingFeePercent: event.processingFeePercent,
        processingFeeFixed: event.processingFeeFixed,
    });
};
exports.resolveEventFeeConfig = resolveEventFeeConfig;
const roundMoney = (value) => Math.round(value * 100) / 100;
const computeFees = async (baseAmount, event) => {
    const amount = Math.max(0, Number(baseAmount || 0));
    const defaults = await (0, exports.getSystemFeeDefaults)();
    const feeConfig = (0, exports.resolveEventFeeConfig)(event, defaults);
    const platformFeeAmount = feeConfig.platformFeeMode === 'FIXED'
        ? Math.min(amount, feeConfig.platformFeeFixed)
        : (amount * feeConfig.platformFeePercent) / 100;
    const processingEstimate = (amount * feeConfig.processingFeePercent) / 100 + feeConfig.processingFeeFixed;
    const organizerAmount = Math.max(0, amount - platformFeeAmount);
    return {
        platformFeeAmount: roundMoney(platformFeeAmount),
        organizerAmount: roundMoney(organizerAmount),
        processingEstimate: roundMoney(processingEstimate),
    };
};
exports.computeFees = computeFees;
exports.defaultFeeConfig = FALLBACK_FEE_CONFIG;
/**
 * A category falls back to the general platform fee when admin has not priced
 * it separately, so upgrading does not silently change anyone's economics.
 */
const resolveCategoryFee = (mode, percent, fixed, fallback, inherited) => {
    const hasOverride = mode != null || percent != null || fixed != null;
    if (!hasOverride) {
        // Nothing named here, so inherit the system-level category if one was
        // resolved for us, and only then fall back to the general platform fee.
        return (inherited || {
            mode: fallback.platformFeeMode,
            percent: fallback.platformFeePercent,
            fixed: fallback.platformFeeFixed,
        });
    }
    return {
        mode: mode != null ? toFeeMode(mode) : fallback.platformFeeMode,
        percent: percent != null ? toNonNegative(percent) : fallback.platformFeePercent,
        fixed: fixed != null ? toNonNegative(fixed) : fallback.platformFeeFixed,
    };
};
const resolveGiftFeeConfig = (event, defaults) => {
    const base = (0, exports.resolveEventFeeConfig)(event, defaults);
    // Event overrides are gated by the same flag the rest of the fee system uses.
    const overridesEnabled = event.feeOverridesEnabled !== false;
    const source = overridesEnabled ? event : defaults;
    // An event running on system fees inherits the system's category pricing.
    // An event with its own fee schedule does not: opting into custom fees means
    // its own platform fee applies to every category it has not priced itself.
    const resolvedDefaults = defaults;
    const inheritedGiftItem = overridesEnabled ? null : resolvedDefaults.giftItem || null;
    const inheritedCashGift = overridesEnabled ? null : resolvedDefaults.cashGift || null;
    return {
        ...base,
        giftItem: resolveCategoryFee(source.giftItemFeeMode, source.giftItemFeePercent, source.giftItemFeeFixed, base, inheritedGiftItem),
        cashGift: resolveCategoryFee(source.cashGiftFeeMode, source.cashGiftFeePercent, source.cashGiftFeeFixed, base, inheritedCashGift),
    };
};
exports.resolveGiftFeeConfig = resolveGiftFeeConfig;
const getGiftFeeDefaults = async () => {
    const settings = await prisma_js_1.default.systemSettings.findUnique({
        where: { id: 'default' },
    });
    const raw = settings || FALLBACK_FEE_CONFIG;
    const base = normalizeFeeConfig(raw);
    const resolved = (0, exports.resolveGiftFeeConfig)({ ...raw, feeOverridesEnabled: true }, { ...raw, ...base });
    // Carry the raw columns through as well, so passing this object back in as
    // `defaults` still describes the system-level category pricing.
    return {
        ...resolved,
        giftItemFeeMode: raw.giftItemFeeMode ?? null,
        giftItemFeePercent: raw.giftItemFeePercent ?? null,
        giftItemFeeFixed: raw.giftItemFeeFixed ?? null,
        cashGiftFeeMode: raw.cashGiftFeeMode ?? null,
        cashGiftFeePercent: raw.cashGiftFeePercent ?? null,
        cashGiftFeeFixed: raw.cashGiftFeeFixed ?? null,
    };
};
exports.getGiftFeeDefaults = getGiftFeeDefaults;
const applyCategoryFee = (amount, fee) => fee.mode === 'FIXED' ? Math.min(amount, fee.fixed) : (amount * fee.percent) / 100;
/**
 * Gift items settle to the platform in full. Cash gifts are what the owner
 * earns, net of the platform fee for that category and the processor's cut:
 *
 *   ownerNet = cashGift - (cashGiftPlatformFee + cashProcessingFee)
 */
const computeGiftSettlement = (input) => {
    const packageAmount = roundMoney(Math.max(0, Number(input.packageAmount || 0)));
    const cashGiftAmount = roundMoney(Math.max(0, Number(input.cashGiftAmount || 0)));
    const totalAmount = roundMoney(packageAmount + cashGiftAmount);
    const { config } = input;
    const giftItemPlatformFee = applyCategoryFee(packageAmount, config.giftItem);
    const cashGiftPlatformFee = applyCategoryFee(cashGiftAmount, config.cashGift);
    // The processor bills the charge once. Its percentage follows the money it
    // was charged on; its flat part is shared in proportion to each portion so a
    // large package purchase cannot push its flat cost onto the guest's gift.
    const cashShare = totalAmount > 0 ? cashGiftAmount / totalAmount : 0;
    const cashProcessingFee = (cashGiftAmount * config.processingFeePercent) / 100 + config.processingFeeFixed * cashShare;
    const processingFeeAmount = totalAmount > 0
        ? (totalAmount * config.processingFeePercent) / 100 + config.processingFeeFixed
        : 0;
    // Clamped: when fees exceed a very small gift the platform absorbs the rest
    // rather than handing the owner a negative balance.
    const ownerNetAmount = roundMoney(Math.max(0, cashGiftAmount - cashGiftPlatformFee - cashProcessingFee));
    return {
        packageAmount,
        cashGiftAmount,
        totalAmount,
        giftItemPlatformFee: roundMoney(giftItemPlatformFee),
        cashGiftPlatformFee: roundMoney(cashGiftPlatformFee),
        platformFeeAmount: roundMoney(giftItemPlatformFee + cashGiftPlatformFee),
        cashProcessingFee: roundMoney(cashProcessingFee),
        processingFeeAmount: roundMoney(processingFeeAmount),
        ownerNetAmount,
        platformNetAmount: roundMoney(Math.max(0, totalAmount - ownerNetAmount - roundMoney(processingFeeAmount))),
    };
};
exports.computeGiftSettlement = computeGiftSettlement;
//# sourceMappingURL=fees.js.map