-- Per-category gift fees + frozen gift settlement columns.
-- Additive and non-destructive: every new column is nullable or defaulted.

-- Admin can price gift items and cash gifts differently. NULL means
-- "fall back to the general platform fee", so existing rows are unchanged.
ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "giftItemFeeMode" TEXT,
ADD COLUMN IF NOT EXISTS "giftItemFeePercent" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "giftItemFeeFixed" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cashGiftFeeMode" TEXT,
ADD COLUMN IF NOT EXISTS "cashGiftFeePercent" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cashGiftFeeFixed" DOUBLE PRECISION;

-- Same overrides at event level, gated by the existing feeOverridesEnabled flag.
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "giftItemFeeMode" TEXT,
ADD COLUMN IF NOT EXISTS "giftItemFeePercent" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "giftItemFeeFixed" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cashGiftFeeMode" TEXT,
ADD COLUMN IF NOT EXISTS "cashGiftFeePercent" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "cashGiftFeeFixed" DOUBLE PRECISION;

-- Settlement is frozen onto the order at fulfilment so that changing fee
-- settings later cannot retroactively restate what an owner already earned.
ALTER TABLE "GiftOrder"
ADD COLUMN IF NOT EXISTS "packageAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "platformFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "processingFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "ownerNetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "payoutRouting" TEXT NOT NULL DEFAULT 'ADMIN_MANUAL';

-- Which gift kinds an event accepts. Default true so existing events keep
-- offering both, matching how gifting behaved before this switch existed.
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "giftItemsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "cashGiftsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Optional stock control for gift packages. NULL keeps a package unlimited,
-- which is how every existing package has always behaved.
ALTER TABLE "GiftPackage"
ADD COLUMN IF NOT EXISTS "stockQuantity" INTEGER,
ADD COLUMN IF NOT EXISTS "soldQuantity" INTEGER NOT NULL DEFAULT 0;
