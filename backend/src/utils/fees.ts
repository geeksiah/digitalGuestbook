import prisma from './prisma.js';

export type FeeMode = 'PERCENTAGE' | 'FIXED';

export type FeeConfig = {
  platformFeeMode: FeeMode;
  platformFeePercent: number;
  platformFeeFixed: number;
  processingFeePercent: number;
  processingFeeFixed: number;
};

const FALLBACK_FEE_CONFIG: FeeConfig = {
  platformFeeMode: 'PERCENTAGE',
  platformFeePercent: 5,
  platformFeeFixed: 0,
  processingFeePercent: 2.9,
  processingFeeFixed: 0.3,
};

const toFeeMode = (value: unknown): FeeMode =>
  String(value || 'PERCENTAGE').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENTAGE';

const toNonNegative = (value: unknown) => Math.max(0, Number(value || 0));

const normalizeFeeConfig = (raw: any): FeeConfig => ({
  platformFeeMode: toFeeMode(raw?.platformFeeMode),
  platformFeePercent: toNonNegative(raw?.platformFeePercent),
  platformFeeFixed: toNonNegative(raw?.platformFeeFixed),
  processingFeePercent: toNonNegative(raw?.processingFeePercent),
  processingFeeFixed: toNonNegative(raw?.processingFeeFixed),
});

export const getSystemFeeDefaults = async (): Promise<FeeConfig> => {
  const settings = await (prisma as any).systemSettings.findUnique({
    where: { id: 'default' },
  });

  return normalizeFeeConfig(settings || FALLBACK_FEE_CONFIG);
};

type EventLikeFeeConfig = {
  feeOverridesEnabled?: boolean | null | undefined;
  platformFeeMode?: string | null | undefined;
  platformFeePercent?: number | null | undefined;
  platformFeeFixed?: number | null | undefined;
  processingFeePercent?: number | null | undefined;
  processingFeeFixed?: number | null | undefined;
};

export const resolveEventFeeConfig = (
  event: EventLikeFeeConfig,
  defaults: FeeConfig
): FeeConfig => {
  // If undefined (older payloads), keep previous behavior: use event-level values.
  const overridesEnabled = event.feeOverridesEnabled !== false;

  if (!overridesEnabled) return defaults;

  return normalizeFeeConfig({
    platformFeeMode: event.platformFeeMode,
    platformFeePercent: event.platformFeePercent,
    platformFeeFixed: event.platformFeeFixed,
    processingFeePercent: event.processingFeePercent,
    processingFeeFixed: event.processingFeeFixed,
  });
};

export const defaultFeeConfig = FALLBACK_FEE_CONFIG;
