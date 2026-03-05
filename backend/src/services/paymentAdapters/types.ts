export type GatewayType = 'paystack' | 'stripe' | 'hubtel';

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
};

export interface PaymentAdapter {
  gateway: GatewayType;
  initializePayment(
    intent: AdapterIntent,
    gatewayConfig: AdapterGatewayConfig
  ): Promise<AdapterInitializeResult>;
  verifyTransaction(
    reference: string,
    gatewayConfig: AdapterGatewayConfig
  ): Promise<AdapterVerifyResult>;
  handleWebhook(
    payload: unknown,
    gatewayConfig: AdapterGatewayConfig
  ): Promise<AdapterWebhookResult>;
}
