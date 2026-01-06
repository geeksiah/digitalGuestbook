-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateTime" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "invitationOnly" BOOLEAN NOT NULL DEFAULT false,
    "featureInvitationWebsite" BOOLEAN NOT NULL DEFAULT false,
    "featureRsvp" BOOLEAN NOT NULL DEFAULT false,
    "featureGuestbook" BOOLEAN NOT NULL DEFAULT false,
    "manualPhaseOverride" TEXT,
    "coupleAccessKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TemplateAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    CONSTRAINT "TemplateAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TemplateAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RSVP" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "guestCount" INTEGER,
    "response" TEXT NOT NULL,
    "mealPreference" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceChannel" TEXT NOT NULL DEFAULT 'WEB',
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RSVP_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "attendeeToken" TEXT NOT NULL,
    "sixDigitCode" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "checkedInAt" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckinLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "invitationId" TEXT,
    "method" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckinLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CheckinLog_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CheckinDevice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CheckinDevice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "rsvpId" TEXT,
    "source" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "durationSec" INTEGER,
    "originalPath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MediaAsset_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PhaseHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "fromPhase" TEXT,
    "toPhase" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PhaseHistory_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RsvpActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RsvpActionLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RsvpActionLog_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Broadcast_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BroadcastDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "broadcastId" TEXT NOT NULL,
    "rsvpId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "target" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BroadcastDelivery_broadcastId_fkey" FOREIGN KEY ("broadcastId") REFERENCES "Broadcast" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BroadcastDelivery_rsvpId_fkey" FOREIGN KEY ("rsvpId") REFERENCES "RSVP" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateAssignment_eventId_templateType_key" ON "TemplateAssignment"("eventId", "templateType");

-- CreateIndex
CREATE INDEX "RSVP_eventId_status_idx" ON "RSVP"("eventId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_rsvpId_key" ON "Invitation"("rsvpId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_attendeeToken_key" ON "Invitation"("attendeeToken");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_eventId_sixDigitCode_key" ON "Invitation"("eventId", "sixDigitCode");

-- CreateIndex
CREATE INDEX "CheckinLog_eventId_createdAt_idx" ON "CheckinLog"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckinDevice_apiKey_key" ON "CheckinDevice"("apiKey");

-- CreateIndex
CREATE INDEX "CheckinDevice_eventId_idx" ON "CheckinDevice"("eventId");

-- CreateIndex
CREATE INDEX "MediaAsset_eventId_createdAt_idx" ON "MediaAsset"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "PhaseHistory_eventId_changedAt_idx" ON "PhaseHistory"("eventId", "changedAt");

-- CreateIndex
CREATE INDEX "RsvpActionLog_eventId_createdAt_idx" ON "RsvpActionLog"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "Broadcast_eventId_createdAt_idx" ON "Broadcast"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "BroadcastDelivery_broadcastId_idx" ON "BroadcastDelivery"("broadcastId");
