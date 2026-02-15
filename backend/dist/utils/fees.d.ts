export type FeeMode = 'PERCENTAGE' | 'FIXED';
export type FeeConfig = {
    platformFeeMode: FeeMode;
    platformFeePercent: number;
    platformFeeFixed: number;
    processingFeePercent: number;
    processingFeeFixed: number;
};
export declare const getSystemFeeDefaults: () => Promise<FeeConfig>;
type EventLikeFeeConfig = {
    feeOverridesEnabled?: boolean | null | undefined;
    platformFeeMode?: string | null | undefined;
    platformFeePercent?: number | null | undefined;
    platformFeeFixed?: number | null | undefined;
    processingFeePercent?: number | null | undefined;
    processingFeeFixed?: number | null | undefined;
};
export declare const resolveEventFeeConfig: (event: EventLikeFeeConfig, defaults: FeeConfig) => FeeConfig;
export declare const defaultFeeConfig: FeeConfig;
export {};
//# sourceMappingURL=fees.d.ts.map