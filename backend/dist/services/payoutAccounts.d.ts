/**
 * Confirming an owner's payout destination before it is saved is gateway
 * specific: Paystack resolves an account number against a bank code, Stripe
 * hands the owner an onboarding session instead. This registry keeps the shape
 * of that question the same for callers, so the wallet form does not need a
 * branch per provider and a new gateway is one entry here.
 */
export type PayoutBank = {
    code: string;
    name: string;
    currency?: string;
    country?: string;
};
export type ResolvedPayoutAccount = {
    accountName: string;
    accountNumber: string;
    bankName?: string | null;
};
export type PayoutAccountProvider = {
    gateway: string;
    /**
     * True when the provider can name the account holder before anything is
     * saved. Providers without it need a hosted onboarding flow instead, and the
     * form should say so rather than pretending a check happened.
     */
    supportsAccountLookup: boolean;
    /** Human explanation used when lookup is not available. */
    unsupportedReason?: string;
    listBanks(params: {
        country?: string;
        currency?: string;
    }): Promise<PayoutBank[]>;
    resolveAccount(params: {
        accountNumber: string;
        bankCode: string;
        currency?: string;
    }): Promise<ResolvedPayoutAccount>;
};
export declare const getPayoutAccountProvider: (gateway: string) => PayoutAccountProvider;
export declare const listPayoutAccountGateways: () => {
    gateway: string;
    supportsAccountLookup: boolean;
    unsupportedReason: string | null;
}[];
//# sourceMappingURL=payoutAccounts.d.ts.map