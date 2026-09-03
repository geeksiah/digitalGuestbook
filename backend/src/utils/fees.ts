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

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const computeFees = async (
  baseAmount: number,
  event: EventLikeFeeConfig
): Promise<{
  platformFeeAmount: number;
  organizerAmount: number;
  processingEstimate: number;
}> => {
  const amount = Math.max(0, Number(baseAmount || 0));
  const defaults = await getSystemFeeDefaults();
  const feeConfig = resolveEventFeeConfig(event, defaults);

  const platformFeeAmount =
    feeConfig.platformFeeMode === 'FIXED'
      ? Math.min(amount, feeConfig.platformFeeFixed)
      : (amount * feeConfig.platformFeePercent) / 100;

  const processingEstimate =
    (amount * feeConfig.processingFeePercent) / 100 + feeConfig.processingFeeFixed;

  const organizerAmount = Math.max(0, amount - platformFeeAmount);

  return {
    platformFeeAmount: roundMoney(platformFeeAmount),
    organizerAmount: roundMoney(organizerAmount),
    processingEstimate: roundMoney(processingEstimate),
  };
};

export const defaultFeeConfig = FALLBACK_FEE_CONFIG;

// ============================================
// Gift settlement
// ============================================

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

/**
 * A category falls back to the general platform fee when admin has not priced
 * it separately, so upgrading does not silently change anyone's economics.
 */
const resolveCategoryFee = (
  mode: unknown,
  percent: unknown,
  fixed: unknown,
  fallback: FeeConfig,
  inherited?: CategoryFee | null
): CategoryFee => {
  const hasOverride = mode != null || percent != null || fixed != null;
  if (!hasOverride) {
    // Nothing named here, so inherit the system-level category if one was
    // resolved for us, and only then fall back to the general platform fee.
    return (
      inherited || {
        mode: fallback.platformFeeMode,
        percent: fallback.platformFeePercent,
        fixed: fallback.platformFeeFixed,
      }
    );
  }
  return {
    mode: mode != null ? toFeeMode(mode) : fallback.platformFeeMode,
    percent: percent != null ? toNonNegative(percent) : fallback.platformFeePercent,
    fixed: fixed != null ? toNonNegative(fixed) : fallback.platformFeeFixed,
  };
};

type GiftFeeSource = EventLikeFeeConfig & {
  giftItemFeeMode?: string | null;
  giftItemFeePercent?: number | null;
  giftItemFeeFixed?: number | null;
  cashGiftFeeMode?: string | null;
  cashGiftFeePercent?: number | null;
  cashGiftFeeFixed?: number | null;
};

export const resolveGiftFeeConfig = (
  event: GiftFeeSource,
  defaults: GiftFeeSource & FeeConfig
): GiftFeeConfig => {
  const base = resolveEventFeeConfig(event, defaults);
  // Event overrides are gated by the same flag the rest of the fee system uses.
  const overridesEnabled = event.feeOverridesEnabled !== false;
  const source = overridesEnabled ? event : defaults;

  // An event running on system fees inherits the system's category pricing.
  // An event with its own fee schedule does not: opting into custom fees means
  // its own platform fee applies to every category it has not priced itself.
  const resolvedDefaults = defaults as Partial<GiftFeeConfig>;
  const inheritedGiftItem = overridesEnabled ? null : resolvedDefaults.giftItem || null;
  const inheritedCashGift = overridesEnabled ? null : resolvedDefaults.cashGift || null;

  return {
    ...base,
    giftItem: resolveCategoryFee(
      source.giftItemFeeMode,
      source.giftItemFeePercent,
      source.giftItemFeeFixed,
      base,
      inheritedGiftItem
    ),
    cashGift: resolveCategoryFee(
      source.cashGiftFeeMode,
      source.cashGiftFeePercent,
      source.cashGiftFeeFixed,
      base,
      inheritedCashGift
    ),
  };
};

export const getGiftFeeDefaults = async (): Promise<GiftFeeConfig> => {
  const settings = await (prisma as any).systemSettings.findUnique({
    where: { id: 'default' },
  });
  const raw = settings || FALLBACK_FEE_CONFIG;
  const base = normalizeFeeConfig(raw);
  const resolved = resolveGiftFeeConfig({ ...raw, feeOverridesEnabled: true }, { ...raw, ...base });
  // Carry the raw columns through as well, so passing this object back in as
  // `defaults` still describes the system-level category pricing.
  return {
    ...resolved,
    giftItemFeeMode: raw.giftItemFeeMode ?? null,
    giftItemFeePercent: raw.giftItemFeePercent ?? null,
    giftItemFeeFixed: raw.giftItemFeeFixed ?? null,
    cashGiftFeeMode: raw.cashGiftFeeMode ?? null,
    cashGiftFeePercent: raw.cashGiftFeePercent ?? null,
    cashGiftFeeFixed: raw.cashGiftFeeFixed ?? null,
  } as GiftFeeConfig;
};

const applyCategoryFee = (amount: number, fee: CategoryFee) =>
  fee.mode === 'FIXED' ? Math.min(amount, fee.fixed) : (amount * fee.percent) / 100;

/**
 * Gift items settle to the platform in full. Cash gifts are what the owner
 * earns, net of the platform fee for that category and the processor's cut:
 *
 *   ownerNet = cashGift - (cashGiftPlatformFee + cashProcessingFee)
 */
export const computeGiftSettlement = (input: {
  packageAmount: number;
  cashGiftAmount: number;
  config: GiftFeeConfig;
}): GiftSettlement => {
  const packageAmount = roundMoney(Math.max(0, Number(input.packageAmount || 0)));
  const cashGiftAmount = roundMoney(Math.max(0, Number(input.cashGiftAmount || 0)));
  const totalAmount = roundMoney(packageAmount + cashGiftAmount);
  const { config } = input;

  const giftItemPlatformFee = applyCategoryFee(packageAmount, config.giftItem);
  const cashGiftPlatformFee = applyCategoryFee(cashGiftAmount, config.cashGift);

  // The processor bills the charge once. Its percentage follows the money it
  // was charged on; its flat part is shared in proportion to each portion so a
  // large package purchase cannot push its flat cost onto the guest's gift.
  const cashShare = totalAmount > 0 ? cashGiftAmount / totalAmount : 0;
  const cashProcessingFee =
    (cashGiftAmount * config.processingFeePercent) / 100 + config.processingFeeFixed * cashShare;
  const processingFeeAmount =
    totalAmount > 0
      ? (totalAmount * config.processingFeePercent) / 100 + config.processingFeeFixed
      : 0;

  // Clamped: when fees exceed a very small gift the platform absorbs the rest
  // rather than handing the owner a negative balance.
  const ownerNetAmount = roundMoney(
    Math.max(0, cashGiftAmount - cashGiftPlatformFee - cashProcessingFee)
  );

  return {
    packageAmount,
    cashGiftAmount,
    totalAmount,
    giftItemPlatformFee: roundMoney(giftItemPlatformFee),
    cashGiftPlatformFee: roundMoney(cashGiftPlatformFee),
    platformFeeAmount: roundMoney(giftItemPlatformFee + cashGiftPlatformFee),
    cashProcessingFee: roundMoney(cashProcessingFee),
    processingFeeAmount: roundMoney(processingFeeAmount),
    ownerNetAmount,
    platformNetAmount: roundMoney(
      Math.max(0, totalAmount - ownerNetAmount - roundMoney(processingFeeAmount))
    ),
  };
};
