import type { PaymentIntent, Transaction } from '@prisma/client';
import type { PaymentNextAction } from './paymentAdapters/types.js';
type CreatePaymentIntentInput = {
    eventId: string;
    purpose: 'TICKET' | 'GIFT' | 'VOTE' | 'USSD_CREDITS_TOPUP' | 'VOTE_PURCHASE';
    amount: number;
    currency?: string;
    paymentGatewayId: string;
    metadata?: Record<string, unknown>;
    idempotencyKey?: string;
};
type CreatePaymentIntentResult = {
    intent: PaymentIntent;
    nextAction: PaymentNextAction;
};
type FinalizeParams = {
    intentId: string;
    status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
    providerTransactionId?: string;
    gatewayReference?: string;
};
type HandleWebhookInput = {
    gateway: string;
    payload: unknown;
    rawPayload?: string;
};
export declare const createPaymentIntent: (input: CreatePaymentIntentInput) => Promise<CreatePaymentIntentResult>;
export declare const verifyGatewayTransaction: (intentId: string, reference?: string) => Promise<import("./paymentAdapters/types.js").AdapterVerifyResult>;
export declare const createTransaction: (intent: PaymentIntent, providerTransactionId: string) => Promise<Transaction>;
export declare const callFulfillmentHandler: (intent: PaymentIntent, tx: Transaction) => Promise<void>;
export declare const finalizePaymentIntent: (params: FinalizeParams) => Promise<{
    intent: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerId: string;
        status: import(".prisma/client").$Enums.PaymentIntentStatus;
        gateway: string;
        currency: string;
        eventId: string;
        amount: number;
        metadataJson: string | null;
        platformFeeAmount: number;
        organizerAmount: number;
        purpose: import(".prisma/client").$Enums.PaymentIntentPurpose;
        gatewayReference: string | null;
        idempotencyKey: string;
    };
    transaction: null;
} | {
    intent: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerId: string;
        status: import(".prisma/client").$Enums.PaymentIntentStatus;
        gateway: string;
        currency: string;
        eventId: string;
        amount: number;
        metadataJson: string | null;
        platformFeeAmount: number;
        organizerAmount: number;
        purpose: import(".prisma/client").$Enums.PaymentIntentPurpose;
        gatewayReference: string | null;
        idempotencyKey: string;
    };
    transaction: {
        id: string;
        createdAt: Date;
        ownerId: string;
        status: import(".prisma/client").$Enums.TransactionStatus;
        gateway: string;
        currency: string;
        eventId: string;
        paymentIntentId: string;
        grossAmount: number;
        platformFeeAmount: number;
        organizerAmount: number;
        providerTransactionId: string;
    };
}>;
export declare const handleWebhook: (input: HandleWebhookInput) => Promise<{
    received: boolean;
    duplicate: boolean;
    status: "FAILED" | "PENDING" | "SUCCEEDED" | "IGNORED";
    paymentIntentId?: undefined;
} | {
    received: boolean;
    status: "FAILED" | "PENDING" | "SUCCEEDED" | "IGNORED";
    paymentIntentId: string | null;
    duplicate?: undefined;
}>;
export {};
//# sourceMappingURL=paymentCore.d.ts.map