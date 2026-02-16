-- Add event-level default currency used by owner/admin create flows
ALTER TABLE "Event"
ADD COLUMN "defaultCurrency" TEXT NOT NULL DEFAULT 'USD';
