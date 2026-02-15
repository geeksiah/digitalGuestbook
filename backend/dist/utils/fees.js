"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFeeConfig = exports.resolveEventFeeConfig = exports.getSystemFeeDefaults = void 0;
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
exports.defaultFeeConfig = FALLBACK_FEE_CONFIG;
//# sourceMappingURL=fees.js.map