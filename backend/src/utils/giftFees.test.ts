import { describe, expect, it } from 'vitest';
import { computeGiftSettlement, resolveGiftFeeConfig, type GiftFeeConfig } from './fees.js';

const systemRaw = {
  platformFeeMode: 'PERCENTAGE',
  platformFeePercent: 5,
  platformFeeFixed: 0,
  processingFeePercent: 2.9,
  processingFeeFixed: 0.3,
};

/** Mirrors getGiftFeeDefaults(): resolved categories plus the raw columns. */
const buildSystemDefaults = (categoryOverrides: Record<string, unknown> = {}) => {
  const raw = { ...systemRaw, ...categoryOverrides } as any;
  const resolved = resolveGiftFeeConfig({ ...raw, feeOverridesEnabled: true }, raw);
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

describe('gift fee resolution', () => {
  it('uses the platform fee when no category is priced', () => {
    const config = resolveGiftFeeConfig({ feeOverridesEnabled: false }, buildSystemDefaults());
    expect(config.giftItem.percent).toBe(5);
    expect(config.cashGift.percent).toBe(5);
  });

  // feeOverridesEnabled defaults to false, so this is the common case: if the
  // system category fee did not reach here, admin's pricing would do nothing.
  it('applies system category fees to an event running on defaults', () => {
    const config = resolveGiftFeeConfig(
      { feeOverridesEnabled: false },
      buildSystemDefaults({ cashGiftFeePercent: 12, giftItemFeePercent: 20 })
    );
    expect(config.cashGift.percent).toBe(12);
    expect(config.giftItem.percent).toBe(20);
  });

  it('lets an event with its own schedule fall back to its own platform fee', () => {
    const config = resolveGiftFeeConfig(
      { feeOverridesEnabled: true, ...systemRaw, platformFeePercent: 8 } as any,
      buildSystemDefaults({ cashGiftFeePercent: 12 })
    );
    expect(config.cashGift.percent).toBe(8);
  });

  it('lets an event price a category directly', () => {
    const config = resolveGiftFeeConfig(
      { feeOverridesEnabled: true, ...systemRaw, cashGiftFeePercent: 3 } as any,
      buildSystemDefaults({ cashGiftFeePercent: 12 })
    );
    expect(config.cashGift.percent).toBe(3);
  });
});

describe('gift settlement', () => {
  const config = resolveGiftFeeConfig(
    { feeOverridesEnabled: true, ...systemRaw, giftItemFeePercent: 15, cashGiftFeePercent: 3 } as any,
    buildSystemDefaults()
  );

  it('charges the guest exactly the gift total', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 200,
      cashGiftAmount: 100,
      config,
    });
    expect(settlement.totalAmount).toBe(300);
  });

  it('prices each category with its own fee', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 200,
      cashGiftAmount: 100,
      config,
    });
    expect(settlement.giftItemPlatformFee).toBe(30);
    expect(settlement.cashGiftPlatformFee).toBe(3);
  });

  it('shares the flat processor cost in proportion to each portion', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 200,
      cashGiftAmount: 100,
      config,
    });
    expect(settlement.cashProcessingFee).toBeCloseTo(100 * 0.029 + 0.3 * (100 / 300), 4);
  });

  it('pays the owner from the cash gift only', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 200,
      cashGiftAmount: 100,
      config,
    });
    const cashProcessing = 100 * 0.029 + 0.3 * (100 / 300);
    expect(settlement.ownerNetAmount).toBeCloseTo(100 - 3 - cashProcessing, 2);
  });

  it('pays the owner nothing for gift items alone', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 150,
      cashGiftAmount: 0,
      config,
    });
    expect(settlement.ownerNetAmount).toBe(0);
    expect(settlement.totalAmount).toBe(150);
  });

  it('conserves money across owner, platform and processor', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 80,
      cashGiftAmount: 120,
      config,
    });
    expect(
      settlement.ownerNetAmount + settlement.platformNetAmount + settlement.processingFeeAmount
    ).toBeCloseTo(settlement.totalAmount, 2);
  });

  it('clamps at zero when fees exceed a very small gift', () => {
    const settlement = computeGiftSettlement({
      packageAmount: 0,
      cashGiftAmount: 0.2,
      config,
    });
    expect(settlement.ownerNetAmount).toBe(0);
  });

  it('never charges a fixed fee larger than the amount it applies to', () => {
    const fixedConfig = resolveGiftFeeConfig(
      {
        feeOverridesEnabled: true,
        ...systemRaw,
        cashGiftFeeMode: 'FIXED',
        cashGiftFeeFixed: 500,
      } as any,
      buildSystemDefaults()
    );
    const settlement = computeGiftSettlement({
      packageAmount: 0,
      cashGiftAmount: 50,
      config: fixedConfig,
    });
    expect(settlement.cashGiftPlatformFee).toBe(50);
    expect(settlement.ownerNetAmount).toBe(0);
  });
});
