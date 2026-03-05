export declare class UssdCreditsService {
    getWallet(input: {
        ownerId?: string | null;
        eventId?: string | null;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerId: string | null;
        currency: string;
        eventId: string | null;
        balanceUnits: number;
    } | null>;
    ensureWalletForEvent(eventId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        ownerId: string | null;
        currency: string;
        eventId: string | null;
        balanceUnits: number;
    }>;
    consumeCredits(walletId: string, units: number, reference: string, metadata?: Record<string, unknown>): Promise<{
        status: "ok";
        idempotent: boolean;
        wallet: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            ownerId: string | null;
            currency: string;
            eventId: string | null;
            balanceUnits: number;
        } | null;
    } | {
        status: "insufficient";
        idempotent: boolean;
        wallet: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            ownerId: string | null;
            currency: string;
            eventId: string | null;
            balanceUnits: number;
        };
    }>;
    topupCredits(input: {
        walletId: string;
        units: number;
        paymentIntentId?: string | null;
        reference: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        idempotent: boolean;
        wallet: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            ownerId: string | null;
            currency: string;
            eventId: string | null;
            balanceUnits: number;
        } | null;
    }>;
}
//# sourceMappingURL=UssdCreditsService.d.ts.map