export type OwnerWalletMode = 'MANUAL_FALLBACK' | 'MANUAL_EXPLICIT' | 'AUTOMATED';
export type OwnerPayoutWalletRecord = {
    id: string;
    walletType: string;
    isActive: boolean;
    isVerified: boolean;
    currency: string;
    paystackSubaccount?: string | null;
    paystackRecipientCode?: string | null;
};
export declare const normalizeWalletType: (walletType?: string | null) => string;
export declare const walletTypeForGateway: (gateway: string) => string | null;
export declare const isManualWalletType: (walletType?: string | null) => boolean;
export declare const isGatewayConfigured: (gateway: any) => boolean;
export declare const isGatewaySupportedInCountry: (gatewayType: string, countryCode?: string | null) => boolean;
export declare const getAvailableWalletTypes: (params: {
    paymentGateways: Array<any>;
    countryCode?: string | null;
}) => string[];
export declare const resolveOwnerWalletState: (wallets?: OwnerPayoutWalletRecord[]) => {
    mode: OwnerWalletMode;
    activeWallets: OwnerPayoutWalletRecord[];
    manualWallet: OwnerPayoutWalletRecord | null;
    automatedWallets: OwnerPayoutWalletRecord[];
    verifiedAutomatedWallets: OwnerPayoutWalletRecord[];
    walletByType: Map<string, OwnerPayoutWalletRecord>;
};
export declare const filterEventGatewaysForOwner: (params: {
    eventGateways: Array<any>;
    walletState: ReturnType<typeof resolveOwnerWalletState>;
}) => any[];
export declare const resolveRoutingForMethod: (params: {
    paymentMethod?: string | null;
    walletState: ReturnType<typeof resolveOwnerWalletState>;
}) => {
    payoutRouting: "OWNER_AUTOMATED";
    wallet: OwnerPayoutWalletRecord;
} | {
    payoutRouting: "ADMIN_MANUAL";
    wallet: null;
};
//# sourceMappingURL=walletPolicy.d.ts.map