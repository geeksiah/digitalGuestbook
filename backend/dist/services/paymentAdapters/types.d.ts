export type GatewayType = 'paystack' | 'stripe' | 'hubtel';
/**
 * Provider-neutral instruction to route part of one charge to the event
 * owner's connected account. Each adapter maps this onto its own primitive:
 * Paystack subaccounts, Stripe transfer_data, and so on. `ownerAmount` is
 * already net of platform and processing fees, so an adapter only has to
 * express "send this much to the destination, keep the rest".
 */
export type PaymentSplit = {
    /** Gateway the destination account belongs to, for a sanity check. */
    gateway: string;
    /** Provider account id that receives the owner share. */
    destinationAccountId: string;
    /** Owner share in major units. */
    ownerAmount: number;
    /**
     * Who absorbs the processor's own fee. 'platform' is the default because
     * the owner share already had an estimated processing fee withheld.
     */
    bearer: 'platform' | 'destination';
};
export type PaymentNextAction = {
    type: 'REDIRECT' | 'INLINE' | 'NONE';
    url?: string;
    reference?: string;
    payload?: Record<string, unknown>;
};
export type AdapterInitializeResult = {
    gatewayReference: string;
    nextAction: PaymentNextAction;
    raw?: unknown;
};
export type AdapterVerifyResult = {
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
    gatewayReference?: string;
    providerTransactionId: string;
    amount?: number;
    currency?: string;
    raw?: unknown;
};
export type AdapterWebhookResult = {
    eventType: string;
    eventKey: string;
    status: 'SUCCEEDED' | 'FAILED' | 'PENDING' | 'IGNORED';
    gatewayReference?: string;
    providerTransactionId?: string;
    amount?: number;
    currency?: string;
    raw?: unknown;
};
export type AdapterGatewayConfig = {
    id: string;
    gateway: string;
    currency?: string | null;
    successUrl?: string | null;
    cancelUrl?: string | null;
    stripeSecretKey?: string | null;
    paystackSecretKey?: string | null;
    hubtelClientId?: string | null;
    hubtelClientSecret?: string | null;
    hubtelConfigJson?: string | null;
};
export type AdapterIntent = {
    id: string;
    eventId: string;
    purpose: 'TICKET' | 'GIFT' | 'VOTE' | 'USSD_CREDITS_TOPUP' | 'VOTE_PURCHASE';
    amount: number;
    currency: string;
    metadata: Record<string, unknown>;
    /** Present only when the owner has a verified connected account. */
    split?: PaymentSplit | null;
};
export interface PaymentAdapter {
    gateway: GatewayType;
    initializePayment(intent: AdapterIntent, gatewayConfig: AdapterGatewayConfig): Promise<AdapterInitializeResult>;
    verifyTransaction(reference: string, gatewayConfig: AdapterGatewayConfig): Promise<AdapterVerifyResult>;
    handleWebhook(payload: unknown, gatewayConfig: AdapterGatewayConfig): Promise<AdapterWebhookResult>;
}
//# sourceMappingURL=types.d.ts.map