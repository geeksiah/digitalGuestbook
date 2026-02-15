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
type PaystackTransferRecipient = {
    id?: number;
    type?: string;
    name?: string;
    recipient_code: string;
    currency?: string;
    active?: boolean;
    details?: Record<string, unknown>;
};
type PaystackTransfer = {
    id?: number;
    transfer_code: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    reason?: string;
    recipient?: {
        recipient_code?: string;
    } | string | null;
    transferred_at?: string | null;
    createdAt?: string;
    updatedAt?: string;
};
type PaystackVerifiedTransaction = {
    id: number;
    reference: string;
    status: string;
    amount: number;
    currency: string;
    paid_at?: string;
    customer?: {
        email?: string;
    };
    metadata?: Record<string, unknown> | null;
    subaccount?: {
        subaccount_code?: string;
    } | string | null;
    split?: {
        subaccount?: string;
    } | null;
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
export declare const verifyPaystackTransaction: (reference: string) => Promise<PaystackVerifiedTransaction>;
export declare const createPaystackTransferRecipient: (payload: {
    name: string;
    accountNumber: string;
    bankCode: string;
    currency?: string;
    type?: "nuban" | "mobile_money";
    description?: string;
}) => Promise<PaystackTransferRecipient>;
export declare const initiatePaystackTransfer: (payload: {
    amount: number;
    recipientCode: string;
    reason?: string;
    reference: string;
    source?: "balance";
    currency?: string;
}) => Promise<PaystackTransfer>;
export declare const fetchPaystackTransfer: (codeOrId: string) => Promise<PaystackTransfer>;
export declare const verifyPaystackWebhookSignature: (rawBody: Buffer | string, signature: string | undefined | null) => Promise<boolean>;
export {};
//# sourceMappingURL=paystack.d.ts.map