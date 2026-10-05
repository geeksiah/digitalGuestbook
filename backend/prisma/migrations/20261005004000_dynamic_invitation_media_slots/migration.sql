ALTER TABLE "InvitationMedia" ADD COLUMN "slotKey" TEXT;
ALTER TABLE "InvitationMedia" ADD COLUMN "collectionKey" TEXT;
ALTER TABLE "InvitationMedia" ALTER COLUMN "role" DROP NOT NULL;
ALTER TABLE "InvitationMedia" ALTER COLUMN "role" DROP DEFAULT;

UPDATE "InvitationMedia" SET "slotKey" = 'hero' WHERE "role" = 'HERO';
UPDATE "InvitationMedia" SET "slotKey" = 'section' WHERE "role" = 'SECTION';
UPDATE "InvitationMedia" SET "collectionKey" = 'gallery' WHERE "role" = 'GALLERY';

CREATE INDEX "InvitationMedia_eventId_slotKey_sortOrder_idx" ON "InvitationMedia"("eventId", "slotKey", "sortOrder");
CREATE INDEX "InvitationMedia_eventId_collectionKey_sortOrder_idx" ON "InvitationMedia"("eventId", "collectionKey", "sortOrder");
