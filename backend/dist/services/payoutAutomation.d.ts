export declare const createPayoutTransferReference: (payoutId: string) => string;
export declare const queuePaystackTransferForPayout: (payoutId: string, initiatedByAdminId?: string | null) => Promise<any>;
export declare const reconcilePaystackTransfer: (params: {
    eventName: string;
    payload: any;
    rawPayload: string;
}) => Promise<any>;
//# sourceMappingURL=payoutAutomation.d.ts.map