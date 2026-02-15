"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reconcilePaystackTransfer = exports.queuePaystackTransferForPayout = exports.createPayoutTransferReference = void 0;
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const paystack_js_1 = require("./paystack.js");
const PAYSTACK_GATEWAY = 'paystack';
const db = prisma_js_1.default;
const toUpper = (value) => (value || '').trim().toUpperCase();
const resolveLedgerState = (eventName, gatewayStatus) => {
    const event = toUpper(eventName);
    const status = toUpper(gatewayStatus);
    if (event === 'TRANSFER.SUCCESS' || status === 'SUCCESS') {
        return {
            status: 'FULFILLED',
            ledgerStatus: 'TRANSFER_SUCCESS',
        };
    }
    if (event === 'TRANSFER.FAILED' || status === 'FAILED') {
        return {
            status: 'REJECTED',
            ledgerStatus: 'TRANSFER_FAILED',
        };
    }
    if (event === 'TRANSFER.REVERSED' || status === 'REVERSED') {
        return {
            status: 'REJECTED',
            ledgerStatus: 'TRANSFER_REVERSED',
        };
    }
    return {
        status: 'PROCESSING',
        ledgerStatus: 'TRANSFER_PENDING',
    };
};
const createPayoutTransferReference = (payoutId) => `ep_payout_${payoutId.replace(/-/g, '')}_${Date.now()}`;
exports.createPayoutTransferReference = createPayoutTransferReference;
const queuePaystackTransferForPayout = async (payoutId, initiatedByAdminId) => {
    const payout = await db.payoutRequest.findUnique({
        where: { id: payoutId },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    ownerId: true,
                },
            },
        },
    });
    if (!payout)
        throw new errorHandler_js_1.AppError('Payout request not found', 404);
    if (!['PENDING', 'DELAYED'].includes(payout.status)) {
        throw new errorHandler_js_1.AppError('Only pending or delayed payouts can be transferred', 400);
    }
    if (!payout.event.ownerId) {
        throw new errorHandler_js_1.AppError('Event does not have an owner account configured', 400);
    }
    const ownerWallet = await db.ownerWallet.findUnique({
        where: { ownerId: payout.event.ownerId },
        select: {
            id: true,
            preferredMethod: true,
            currency: true,
            paystackRecipientCode: true,
            isVerified: true,
        },
    });
    if (!ownerWallet) {
        throw new errorHandler_js_1.AppError('Owner wallet is not configured for this payout', 400);
    }
    if ((ownerWallet.preferredMethod || '').toLowerCase() !== PAYSTACK_GATEWAY) {
        throw new errorHandler_js_1.AppError('Owner payout method is not Paystack', 400);
    }
    if (!ownerWallet.paystackRecipientCode) {
        throw new errorHandler_js_1.AppError('Owner Paystack receiving account is not fully connected', 400);
    }
    const transferReference = payout.gatewayTransferReference || (0, exports.createPayoutTransferReference)(payout.id);
    const reason = payout.notes || `Event payout for ${payout.event.name}`;
    const transfer = await (0, paystack_js_1.initiatePaystackTransfer)({
        amount: payout.requestedAmount,
        recipientCode: ownerWallet.paystackRecipientCode,
        reason,
        reference: transferReference,
    });
    const mapped = resolveLedgerState('', transfer.status);
    const reconciledAt = mapped.status === 'PROCESSING' ? null : new Date();
    const processedAt = mapped.status === 'FULFILLED' ? new Date() : null;
    const updated = await db.payoutRequest.update({
        where: { id: payout.id },
        data: {
            status: mapped.status,
            ledgerStatus: mapped.ledgerStatus,
            gateway: PAYSTACK_GATEWAY,
            payoutReference: payout.payoutReference || transferReference,
            gatewayTransferCode: transfer.transfer_code || payout.gatewayTransferCode,
            gatewayTransferReference: transfer.reference || transferReference,
            gatewayRecipientCode: ownerWallet.paystackRecipientCode,
            gatewayStatus: toUpper(transfer.status) || null,
            transactionRef: transfer.reference || transferReference,
            processedBy: initiatedByAdminId || payout.processedBy || null,
            reconciledAt,
            processedAt,
            rejectionReason: mapped.status === 'REJECTED' ? (transfer.reason || payout.rejectionReason || null) : null,
            failureMessage: mapped.status === 'REJECTED' ? (transfer.reason || 'Transfer failed') : null,
            failureCode: mapped.status === 'REJECTED' ? (toUpper(transfer.status) || 'FAILED') : null,
            reconciliationVersion: { increment: 1 },
        },
    });
    await db.auditLog.create({
        data: {
            eventId: payout.eventId,
            adminId: initiatedByAdminId || null,
            action: 'PAYOUT_TRANSFER_INITIATED',
            entityType: 'PAYOUT',
            entityId: payout.id,
            details: JSON.stringify({
                gateway: PAYSTACK_GATEWAY,
                transferCode: transfer.transfer_code || null,
                transferReference: transfer.reference || transferReference,
                gatewayStatus: transfer.status,
            }),
        },
    });
    return updated;
};
exports.queuePaystackTransferForPayout = queuePaystackTransferForPayout;
const reconcilePaystackTransfer = async (params) => {
    const transferCode = params.payload?.data?.transfer_code ||
        params.payload?.data?.transferCode ||
        null;
    const transferReference = params.payload?.data?.reference ||
        params.payload?.data?.transfer_reference ||
        null;
    const gatewayStatus = params.payload?.data?.status ||
        null;
    const failureReason = params.payload?.data?.reason ||
        params.payload?.message ||
        null;
    const payout = await db.payoutRequest.findFirst({
        where: {
            OR: [
                transferCode ? { gatewayTransferCode: transferCode } : undefined,
                transferReference ? { gatewayTransferReference: transferReference } : undefined,
                transferReference ? { transactionRef: transferReference } : undefined,
            ].filter(Boolean),
        },
    });
    if (!payout) {
        return null;
    }
    const mapped = resolveLedgerState(params.eventName, gatewayStatus || '');
    const now = new Date();
    const updated = await db.payoutRequest.update({
        where: { id: payout.id },
        data: {
            status: mapped.status,
            ledgerStatus: mapped.ledgerStatus,
            gateway: PAYSTACK_GATEWAY,
            gatewayStatus: toUpper(gatewayStatus) || null,
            gatewayTransferCode: transferCode || payout.gatewayTransferCode,
            gatewayTransferReference: transferReference || payout.gatewayTransferReference,
            transactionRef: transferReference || payout.transactionRef,
            webhookLastEvent: params.eventName,
            webhookLastPayload: params.rawPayload.slice(0, 10000),
            failureMessage: mapped.status === 'REJECTED' ? (failureReason || 'Transfer reconciliation failed') : null,
            failureCode: mapped.status === 'REJECTED' ? (toUpper(gatewayStatus) || toUpper(params.eventName)) : null,
            rejectionReason: mapped.status === 'REJECTED' ? (failureReason || payout.rejectionReason || null) : null,
            reconciledAt: now,
            processedAt: mapped.status === 'FULFILLED' ? (payout.processedAt || now) : payout.processedAt,
            reconciliationVersion: { increment: 1 },
        },
    });
    await db.auditLog.create({
        data: {
            eventId: payout.eventId,
            action: 'PAYOUT_TRANSFER_RECONCILED',
            entityType: 'PAYOUT',
            entityId: payout.id,
            details: JSON.stringify({
                webhookEvent: params.eventName,
                transferCode,
                transferReference,
                gatewayStatus,
                mappedStatus: mapped.status,
                ledgerStatus: mapped.ledgerStatus,
            }),
        },
    });
    return updated;
};
exports.reconcilePaystackTransfer = reconcilePaystackTransfer;
//# sourceMappingURL=payoutAutomation.js.map