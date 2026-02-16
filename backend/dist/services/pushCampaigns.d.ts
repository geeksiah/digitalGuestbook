export type CampaignAudienceType = 'ALL_OWNERS' | 'ACTIVE_OWNERS' | 'PENDING_APPROVAL_OWNERS' | 'CUSTOM_OWNER_IDS';
type ResolveAudienceInput = {
    audienceType: CampaignAudienceType;
    ownerIds?: string[];
};
export declare function resolveCampaignAudience(input: ResolveAudienceInput): Promise<string[]>;
export declare function dispatchCampaign(campaignId: string): Promise<{
    notifications: number;
    deliveries: number;
    pushed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=pushCampaigns.d.ts.map