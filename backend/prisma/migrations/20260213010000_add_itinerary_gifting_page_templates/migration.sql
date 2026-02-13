ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "itineraryPageTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "giftingPageTemplateId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_itineraryPageTemplateId_fkey'
  ) THEN
    ALTER TABLE "Event"
    ADD CONSTRAINT "Event_itineraryPageTemplateId_fkey"
    FOREIGN KEY ("itineraryPageTemplateId")
    REFERENCES "Template"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_giftingPageTemplateId_fkey'
  ) THEN
    ALTER TABLE "Event"
    ADD CONSTRAINT "Event_giftingPageTemplateId_fkey"
    FOREIGN KEY ("giftingPageTemplateId")
    REFERENCES "Template"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
