CREATE TABLE "InvitationMedia" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'GALLERY',
    "type" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "alt" TEXT,
    "caption" TEXT,
    "posterPath" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InvitationMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InvitationMedia_eventId_role_sortOrder_idx" ON "InvitationMedia"("eventId", "role", "sortOrder");
ALTER TABLE "InvitationMedia" ADD CONSTRAINT "InvitationMedia_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
