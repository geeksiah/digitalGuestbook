const toBooleanFlag = (value: string | undefined, defaultValue = false) => {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
};

export const featureFlags = {
  ownerEventApproval: toBooleanFlag(process.env.FF_OWNER_EVENT_APPROVAL, true),
  ownerPush: toBooleanFlag(process.env.FF_OWNER_PUSH, true),
  ownerMarketingCampaigns: toBooleanFlag(process.env.FF_OWNER_MARKETING_CAMPAIGNS, true),
  ownerUpdateCheck: toBooleanFlag(process.env.FF_OWNER_UPDATE_CHECK, true),
  ownerMediaAlbumsMobile: toBooleanFlag(process.env.FF_OWNER_MEDIA_ALBUMS_MOBILE, true),
};

export const isFeatureEnabled = (flag: keyof typeof featureFlags) => featureFlags[flag];
