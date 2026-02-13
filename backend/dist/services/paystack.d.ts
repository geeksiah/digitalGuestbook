type PaystackResolvedAccount = {
    account_number: string;
    account_name: string;
    bank_name?: string;
    bank_id?: number;
};
type PaystackSubaccount = {
    id?: number;
    subaccount_code: string;
    business_name: string;
    account_number?: string;
    settlement_bank?: string;
    active?: boolean;
};
export declare const getPaystackBanks: (params?: {
    country?: string;
    currency?: string;
}) => Promise<{
    code: string;
    name: string;
    currency: string | undefined;
    country: string | undefined;
}[]>;
export declare const resolvePaystackAccount: (accountNumber: string, bankCode: string) => Promise<PaystackResolvedAccount>;
export declare const createPaystackSubaccount: (payload: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge?: number;
    primaryContactName?: string;
    primaryContactEmail?: string;
    description?: string;
}) => Promise<PaystackSubaccount>;
export declare const updatePaystackSubaccount: (subaccountCode: string, payload: {
    businessName: string;
    bankCode: string;
    accountNumber: string;
    percentageCharge?: number;
    primaryContactName?: string;
    primaryContactEmail?: string;
    description?: string;
}) => Promise<PaystackSubaccount>;
export {};
//# sourceMappingURL=paystack.d.ts.map