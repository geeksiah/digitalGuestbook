"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UssdCreditsService = void 0;
const errorHandler_js_1 = require("../../../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../../../utils/prisma.js"));
class UssdCreditsService {
    async getWallet(input) {
        return prisma_js_1.default.ussdCreditWallet.findFirst({
            where: {
                ownerId: input.ownerId ?? undefined,
                eventId: input.eventId ?? undefined,
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async ensureWalletForEvent(eventId) {
        const event = await prisma_js_1.default.event.findUnique({
            where: { id: eventId },
            select: { id: true, ownerId: true, defaultCurrency: true },
        });
        if (!event)
            throw new errorHandler_js_1.AppError('Event not found', 404);
        const existing = await prisma_js_1.default.ussdCreditWallet.findFirst({
            where: { eventId: event.id },
        });
        if (existing)
            return existing;
        return prisma_js_1.default.ussdCreditWallet.create({
            data: {
                ownerId: event.ownerId ?? null,
                eventId: event.id,
                currency: event.defaultCurrency || 'USD',
            },
        });
    }
    async consumeCredits(walletId, units, reference, metadata) {
        if (!Number.isFinite(units) || units <= 0)
            throw new errorHandler_js_1.AppError('Units must be greater than zero', 400);
        if (!reference.trim())
            throw new errorHandler_js_1.AppError('Reference is required', 400);
        return prisma_js_1.default.$transaction(async (tx) => {
            const existing = await tx.ussdCreditLedgerEntry.findFirst({
                where: {
                    walletId,
                    type: 'CONSUME',
                    reference,
                },
            });
            if (existing) {
                const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: walletId } });
                return {
                    status: 'ok',
                    idempotent: true,
                    wallet,
                };
            }
            const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: walletId } });
            if (!wallet)
                throw new errorHandler_js_1.AppError('USSD wallet not found', 404);
            if (wallet.balanceUnits < units) {
                return {
                    status: 'insufficient',
                    idempotent: false,
                    wallet,
                };
            }
            await tx.ussdCreditLedgerEntry.create({
                data: {
                    walletId,
                    type: 'CONSUME',
                    amountUnits: -Math.abs(units),
                    reference,
                    metadataJson: metadata ? JSON.stringify(metadata) : null,
                },
            });
            const updated = await tx.ussdCreditWallet.update({
                where: { id: walletId },
                data: {
                    balanceUnits: { decrement: units },
                },
            });
            return {
                status: 'ok',
                idempotent: false,
                wallet: updated,
            };
        });
    }
    async topupCredits(input) {
        if (!Number.isFinite(input.units) || input.units <= 0) {
            throw new errorHandler_js_1.AppError('Units must be greater than zero', 400);
        }
        if (!input.reference.trim())
            throw new errorHandler_js_1.AppError('Reference is required', 400);
        return prisma_js_1.default.$transaction(async (tx) => {
            const existing = await tx.ussdCreditLedgerEntry.findFirst({
                where: {
                    walletId: input.walletId,
                    type: 'TOPUP',
                    reference: input.reference,
                },
            });
            if (existing) {
                const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: input.walletId } });
                return {
                    idempotent: true,
                    wallet,
                };
            }
            await tx.ussdCreditLedgerEntry.create({
                data: {
                    walletId: input.walletId,
                    type: 'TOPUP',
                    amountUnits: Math.abs(input.units),
                    reference: input.reference,
                    paymentIntentId: input.paymentIntentId ?? null,
                    metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
                },
            });
            const wallet = await tx.ussdCreditWallet.update({
                where: { id: input.walletId },
                data: {
                    balanceUnits: { increment: Math.abs(input.units) },
                },
            });
            return {
                idempotent: false,
                wallet,
            };
        });
    }
}
exports.UssdCreditsService = UssdCreditsService;
//# sourceMappingURL=UssdCreditsService.js.map