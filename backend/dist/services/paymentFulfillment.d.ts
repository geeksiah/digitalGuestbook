import type { PaymentIntent, Transaction } from '@prisma/client';
export declare const releaseTicketInventoryHolds: (paymentIntentId: string, reason?: "RELEASED" | "EXPIRED") => Promise<void>;
export declare const fulfillTicketPurchase: (intent: PaymentIntent, tx: Transaction) => Promise<{
    id: string;
} | undefined>;
export declare const fulfillGiftPurchase: (intent: PaymentIntent, tx: Transaction) => Promise<{
    id: string;
} | undefined>;
export declare const fulfillVotePurchase: (intent: PaymentIntent, tx: Transaction) => Promise<{
    id: string;
} | undefined>;
//# sourceMappingURL=paymentFulfillment.d.ts.map