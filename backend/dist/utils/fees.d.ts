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
export declare const computeFees: (baseAmount: number, event: EventLikeFeeConfig) => Promise<{
    platformFeeAmount: number;
    organizerAmount: number;
    processingEstimate: number;
}>;
export declare const defaultFeeConfig: FeeConfig;
export type CategoryFee = {
    mode: FeeMode;
    percent: number;
    fixed: number;
};
export type GiftFeeConfig = FeeConfig & {
    giftItem: CategoryFee;
    cashGift: CategoryFee;
};
export type GiftSettlement = {
    packageAmount: number;
    cashGiftAmount: number;
    totalAmount: number;
    /** Platform fee booked against the gift-item portion. */
    giftItemPlatformFee: number;
    /** Platform fee taken out of the cash gift before the owner is paid. */
    cashGiftPlatformFee: number;
    platformFeeAmount: number;
    /** Processor cost attributed to the cash portion only. */
    cashProcessingFee: number;
    processingFeeAmount: number;
    /** What reaches the owner. Gift items never contribute to this. */
    ownerNetAmount: number;
    /** What the platform keeps once the owner and the processor are paid. */
    platformNetAmount: number;
};
type GiftFeeSource = EventLikeFeeConfig & {
    giftItemFeeMode?: string | null;
    giftItemFeePercent?: number | null;
    giftItemFeeFixed?: number | null;
    cashGiftFeeMode?: string | null;
    cashGiftFeePercent?: number | null;
    cashGiftFeeFixed?: number | null;
};
export declare const resolveGiftFeeConfig: (event: GiftFeeSource, defaults: GiftFeeSource & FeeConfig) => GiftFeeConfig;
export declare const getGiftFeeDefaults: () => Promise<GiftFeeConfig>;
/**
 * Gift items settle to the platform in full. Cash gifts are what the owner
 * earns, net of the platform fee for that category and the processor's cut:
 *
 *   ownerNet = cashGift - (cashGiftPlatformFee + cashProcessingFee)
 */
export declare const computeGiftSettlement: (input: {
    packageAmount: number;
    cashGiftAmount: number;
    config: GiftFeeConfig;
}) => GiftSettlement;
export {};
//# sourceMappingURL=fees.d.ts.map