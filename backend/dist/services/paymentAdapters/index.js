"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGatewayConfigForIntent = exports.getPaymentAdapter = void 0;
const errorHandler_js_1 = require("../../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../../utils/prisma.js"));
const hubtelAdapter_js_1 = require("./hubtelAdapter.js");
const paystackAdapter_js_1 = require("./paystackAdapter.js");
const stripeAdapter_js_1 = require("./stripeAdapter.js");
const ADAPTERS = {
    paystack: paystackAdapter_js_1.paystackAdapter,
    stripe: stripeAdapter_js_1.stripeAdapter,
    hubtel: hubtelAdapter_js_1.hubtelAdapter,
};
const getPaymentAdapter = (gateway) => {
    const normalized = String(gateway || '').trim().toLowerCase();
    const adapter = ADAPTERS[normalized];
    if (!adapter) {
        throw new errorHandler_js_1.AppError(`Unsupported gateway adapter: ${gateway}`, 400);
    }
    return adapter;
};
exports.getPaymentAdapter = getPaymentAdapter;
const resolveGatewayConfigForIntent = async (paymentIntentId) => {
    const intent = await prisma_js_1.default.paymentIntent.findUnique({
        where: { id: paymentIntentId },
        select: { id: true, gateway: true, metadataJson: true },
    });
    if (!intent)
        throw new errorHandler_js_1.AppError('Payment intent not found', 404);
    const metadata = intent.metadataJson ? JSON.parse(intent.metadataJson) : {};
    const configuredGatewayId = typeof metadata.paymentGatewayId === 'string' ? metadata.paymentGatewayId : null;
    let gatewayConfig = configuredGatewayId
        ? await prisma_js_1.default.paymentGateway.findFirst({
            where: { id: configuredGatewayId, isActive: true },
        })
        : null;
    if (!gatewayConfig) {
        gatewayConfig = await prisma_js_1.default.paymentGateway.findFirst({
            where: {
                gateway: intent.gateway,
                isActive: true,
            },
            orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
        });
    }
    if (!gatewayConfig) {
        throw new errorHandler_js_1.AppError(`No active ${intent.gateway} gateway config found`, 400);
    }
    return gatewayConfig;
};
exports.resolveGatewayConfigForIntent = resolveGatewayConfigForIntent;
//# sourceMappingURL=index.js.map