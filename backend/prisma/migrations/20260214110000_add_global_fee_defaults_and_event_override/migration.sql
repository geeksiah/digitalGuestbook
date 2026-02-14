-- Add global fee defaults + event-level override control
-- Non-destructive and backward-safe

ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "platformFeeMode" TEXT NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN IF NOT EXISTS "platformFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS "platformFeeFixed" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "processingFeePercent" DOUBLE PRECISION NOT NULL DEFAULT 2.9,
ADD COLUMN IF NOT EXISTS "processingFeeFixed" DOUBLE PRECISION NOT NULL DEFAULT 0.30;

ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "feeOverridesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Preserve current behavior for existing events:
-- existing rows keep using their event-level fee values by default.
UPDATE "Event"
SET "feeOverridesEnabled" = TRUE
WHERE "feeOverridesEnabled" = FALSE;
