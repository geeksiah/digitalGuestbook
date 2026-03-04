import type { AdapterGatewayConfig, PaymentAdapter } from './types.js';
export declare const getPaymentAdapter: (gateway: string) => PaymentAdapter;
export declare const resolveGatewayConfigForIntent: (paymentIntentId: string) => Promise<AdapterGatewayConfig>;
//# sourceMappingURL=index.d.ts.map