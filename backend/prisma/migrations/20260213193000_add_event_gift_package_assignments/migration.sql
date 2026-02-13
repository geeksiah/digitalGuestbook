-- Event-level gift package assignment mapping
-- Safe additive migration for production

CREATE TABLE IF NOT EXISTS "EventGiftPackage" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "giftPackageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventGiftPackage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventGiftPackage_eventId_giftPackageId_key"
  ON "EventGiftPackage"("eventId", "giftPackageId");

CREATE INDEX IF NOT EXISTS "EventGiftPackage_eventId_idx"
  ON "EventGiftPackage"("eventId");

CREATE INDEX IF NOT EXISTS "EventGiftPackage_giftPackageId_idx"
  ON "EventGiftPackage"("giftPackageId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventGiftPackage_eventId_fkey'
  ) THEN
    ALTER TABLE "EventGiftPackage"
    ADD CONSTRAINT "EventGiftPackage_eventId_fkey"
    FOREIGN KEY ("eventId")
    REFERENCES "Event"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EventGiftPackage_giftPackageId_fkey'
  ) THEN
    ALTER TABLE "EventGiftPackage"
    ADD CONSTRAINT "EventGiftPackage_giftPackageId_fkey"
    FOREIGN KEY ("giftPackageId")
    REFERENCES "GiftPackage"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;
  END IF;
END $$;

