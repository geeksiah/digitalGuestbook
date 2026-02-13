-- Add Event social metadata and phased feature flags
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "socialTitle" TEXT,
ADD COLUMN IF NOT EXISTS "socialDescription" TEXT,
ADD COLUMN IF NOT EXISTS "coverImagePath" TEXT,
ADD COLUMN IF NOT EXISTS "coverImageAlt" TEXT,
ADD COLUMN IF NOT EXISTS "strictInviteOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "itineraryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "itineraryTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "giftingEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Backfill social metadata defaults where possible
UPDATE "Event"
SET
  "socialTitle" = COALESCE("socialTitle", "name"),
  "socialDescription" = COALESCE("socialDescription", "description")
WHERE "socialTitle" IS NULL OR "socialDescription" IS NULL;

-- Custom domains
CREATE TABLE IF NOT EXISTS "EventDomain" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "host" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "verificationToken" TEXT NOT NULL,
  "verificationNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EventDomain_host_key" ON "EventDomain"("host");
CREATE INDEX IF NOT EXISTS "EventDomain_eventId_idx" ON "EventDomain"("eventId");
CREATE INDEX IF NOT EXISTS "EventDomain_status_idx" ON "EventDomain"("status");

ALTER TABLE "EventDomain"
ADD CONSTRAINT "EventDomain_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- RSVP invites
CREATE TABLE IF NOT EXISTS "RsvpInvite" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "rsvpId" TEXT,
  "token" TEXT NOT NULL,
  "inviteeName" TEXT,
  "inviteePhone" TEXT NOT NULL,
  "inviteeEmail" TEXT,
  "providerMessageId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "initialResponse" TEXT,
  "partySize" INTEGER,
  "note" TEXT,
  "sentByOwnerId" TEXT,
  "openedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RsvpInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RsvpInvite_token_key" ON "RsvpInvite"("token");
CREATE INDEX IF NOT EXISTS "RsvpInvite_eventId_idx" ON "RsvpInvite"("eventId");
CREATE INDEX IF NOT EXISTS "RsvpInvite_status_idx" ON "RsvpInvite"("status");
CREATE INDEX IF NOT EXISTS "RsvpInvite_providerMessageId_idx" ON "RsvpInvite"("providerMessageId");

ALTER TABLE "RsvpInvite"
ADD CONSTRAINT "RsvpInvite_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "RsvpInvite"
ADD CONSTRAINT "RsvpInvite_rsvpId_fkey"
FOREIGN KEY ("rsvpId")
REFERENCES "RSVP"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "RsvpInvite"
ADD CONSTRAINT "RsvpInvite_sentByOwnerId_fkey"
FOREIGN KEY ("sentByOwnerId")
REFERENCES "Owner"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- WhatsApp webhook idempotency log
CREATE TABLE IF NOT EXISTS "WhatsappWebhookEvent" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "eventType" TEXT,
  "payload" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsappWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappWebhookEvent_providerMessageId_key" ON "WhatsappWebhookEvent"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsappWebhookEvent_provider_idx" ON "WhatsappWebhookEvent"("provider");

-- Itinerary models
CREATE TABLE IF NOT EXISTS "ItineraryTemplate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "itemsJson" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItineraryTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ItineraryMcSession" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "displayName" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ItineraryMcSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ItineraryMcSession_token_key" ON "ItineraryMcSession"("token");
CREATE INDEX IF NOT EXISTS "ItineraryMcSession_eventId_idx" ON "ItineraryMcSession"("eventId");

ALTER TABLE "ItineraryMcSession"
ADD CONSTRAINT "ItineraryMcSession_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "EventItineraryItem" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "templateId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "location" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "completedBySessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventItineraryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EventItineraryItem_eventId_sortOrder_idx" ON "EventItineraryItem"("eventId", "sortOrder");
CREATE INDEX IF NOT EXISTS "EventItineraryItem_templateId_idx" ON "EventItineraryItem"("templateId");

ALTER TABLE "EventItineraryItem"
ADD CONSTRAINT "EventItineraryItem_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "EventItineraryItem"
ADD CONSTRAINT "EventItineraryItem_templateId_fkey"
FOREIGN KEY ("templateId")
REFERENCES "ItineraryTemplate"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "EventItineraryItem"
ADD CONSTRAINT "EventItineraryItem_completedBySessionId_fkey"
FOREIGN KEY ("completedBySessionId")
REFERENCES "ItineraryMcSession"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Event"
ADD CONSTRAINT "Event_itineraryTemplateId_fkey"
FOREIGN KEY ("itineraryTemplateId")
REFERENCES "ItineraryTemplate"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- Gifting models
CREATE TABLE IF NOT EXISTS "GiftPackage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "price" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "thumbnailPath" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GiftOrder" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "guestName" TEXT NOT NULL,
  "guestPhone" TEXT,
  "guestEmail" TEXT,
  "deliveryDate" TIMESTAMP(3),
  "note" TEXT,
  "paymentMethod" TEXT,
  "paymentReference" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "cashGiftAmount" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiftOrder_eventId_status_idx" ON "GiftOrder"("eventId", "status");

ALTER TABLE "GiftOrder"
ADD CONSTRAINT "GiftOrder_eventId_fkey"
FOREIGN KEY ("eventId")
REFERENCES "Event"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "GiftOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "giftPackageId" TEXT,
  "type" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DOUBLE PRECISION NOT NULL,
  "lineTotal" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GiftOrderItem_orderId_idx" ON "GiftOrderItem"("orderId");

ALTER TABLE "GiftOrderItem"
ADD CONSTRAINT "GiftOrderItem_orderId_fkey"
FOREIGN KEY ("orderId")
REFERENCES "GiftOrder"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "GiftOrderItem"
ADD CONSTRAINT "GiftOrderItem_giftPackageId_fkey"
FOREIGN KEY ("giftPackageId")
REFERENCES "GiftPackage"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
