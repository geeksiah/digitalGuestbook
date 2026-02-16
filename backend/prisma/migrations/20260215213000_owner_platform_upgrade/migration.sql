-- Owner platform upgrade foundations (additive / backward compatible)

-- Event approval workflow
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS "approvalSubmittedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvalReviewedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "approvalReviewedByAdminId" TEXT,
ADD COLUMN IF NOT EXISTS "approvalRejectionReason" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Event_approvalReviewedByAdminId_fkey'
  ) THEN
    ALTER TABLE "Event"
    ADD CONSTRAINT "Event_approvalReviewedByAdminId_fkey"
      FOREIGN KEY ("approvalReviewedByAdminId")
      REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS "Event_ownerId_approvalStatus_idx"
  ON "Event"("ownerId", "approvalStatus");
CREATE INDEX IF NOT EXISTS "Event_approvalStatus_approvalSubmittedAt_idx"
  ON "Event"("approvalStatus", "approvalSubmittedAt");

-- Owner notifications and preferences
CREATE TABLE IF NOT EXISTS "OwnerNotificationPreference" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "marketingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
  "hapticsEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OwnerNotificationPreference_ownerId_key"
  ON "OwnerNotificationPreference"("ownerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OwnerNotificationPreference_ownerId_fkey'
  ) THEN
    ALTER TABLE "OwnerNotificationPreference"
    ADD CONSTRAINT "OwnerNotificationPreference_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "OwnerDevice" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "oneSignalPlayerId" TEXT,
  "appVersion" TEXT,
  "deviceModel" TEXT,
  "osVersion" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OwnerDevice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OwnerDevice_ownerId_isActive_idx"
  ON "OwnerDevice"("ownerId", "isActive");
CREATE INDEX IF NOT EXISTS "OwnerDevice_oneSignalPlayerId_idx"
  ON "OwnerDevice"("oneSignalPlayerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OwnerDevice_ownerId_fkey'
  ) THEN
    ALTER TABLE "OwnerDevice"
    ADD CONSTRAINT "OwnerDevice_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "OwnerNotification" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'SYSTEM',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deepLink" TEXT,
  "dataJson" TEXT,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OwnerNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OwnerNotification_ownerId_createdAt_idx"
  ON "OwnerNotification"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "OwnerNotification_ownerId_isRead_idx"
  ON "OwnerNotification"("ownerId", "isRead");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'OwnerNotification_ownerId_fkey'
  ) THEN
    ALTER TABLE "OwnerNotification"
    ADD CONSTRAINT "OwnerNotification_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- RSVP status transition history
CREATE TABLE IF NOT EXISTS "RSVPStatusAudit" (
  "id" TEXT NOT NULL,
  "rsvpId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "fromStatus" TEXT NOT NULL,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByOwnerId" TEXT,
  "changedByAdminId" TEXT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RSVPStatusAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RSVPStatusAudit_rsvpId_changedAt_idx"
  ON "RSVPStatusAudit"("rsvpId", "changedAt");
CREATE INDEX IF NOT EXISTS "RSVPStatusAudit_eventId_changedAt_idx"
  ON "RSVPStatusAudit"("eventId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RSVPStatusAudit_rsvpId_fkey'
  ) THEN
    ALTER TABLE "RSVPStatusAudit"
    ADD CONSTRAINT "RSVPStatusAudit_rsvpId_fkey"
      FOREIGN KEY ("rsvpId") REFERENCES "RSVP"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RSVPStatusAudit_eventId_fkey'
  ) THEN
    ALTER TABLE "RSVPStatusAudit"
    ADD CONSTRAINT "RSVPStatusAudit_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RSVPStatusAudit_changedByOwnerId_fkey'
  ) THEN
    ALTER TABLE "RSVPStatusAudit"
    ADD CONSTRAINT "RSVPStatusAudit_changedByOwnerId_fkey"
      FOREIGN KEY ("changedByOwnerId") REFERENCES "Owner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RSVPStatusAudit_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "RSVPStatusAudit"
    ADD CONSTRAINT "RSVPStatusAudit_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Push campaigns
CREATE TABLE IF NOT EXISTS "PushCampaign" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "deepLink" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "scheduledAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushCampaign_status_scheduledAt_idx"
  ON "PushCampaign"("status", "scheduledAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaign_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "PushCampaign"
    ADD CONSTRAINT "PushCampaign_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "PushCampaignAudience" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "audienceType" TEXT NOT NULL,
  "audienceQuery" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushCampaignAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushCampaignAudience_campaignId_idx"
  ON "PushCampaignAudience"("campaignId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaignAudience_campaignId_fkey'
  ) THEN
    ALTER TABLE "PushCampaignAudience"
    ADD CONSTRAINT "PushCampaignAudience_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "PushCampaignDelivery" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "campaignId" TEXT,
  "ownerNotificationId" TEXT,
  "deviceId" TEXT,
  "oneSignalPlayerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "failureReason" TEXT,
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "clickedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PushCampaignDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PushCampaignDelivery_campaignId_status_idx"
  ON "PushCampaignDelivery"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "PushCampaignDelivery_ownerId_status_idx"
  ON "PushCampaignDelivery"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "PushCampaignDelivery_ownerNotificationId_idx"
  ON "PushCampaignDelivery"("ownerNotificationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaignDelivery_campaignId_fkey'
  ) THEN
    ALTER TABLE "PushCampaignDelivery"
    ADD CONSTRAINT "PushCampaignDelivery_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "PushCampaign"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaignDelivery_ownerId_fkey'
  ) THEN
    ALTER TABLE "PushCampaignDelivery"
    ADD CONSTRAINT "PushCampaignDelivery_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaignDelivery_ownerNotificationId_fkey'
  ) THEN
    ALTER TABLE "PushCampaignDelivery"
    ADD CONSTRAINT "PushCampaignDelivery_ownerNotificationId_fkey"
      FOREIGN KEY ("ownerNotificationId") REFERENCES "OwnerNotification"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PushCampaignDelivery_deviceId_fkey'
  ) THEN
    ALTER TABLE "PushCampaignDelivery"
    ADD CONSTRAINT "PushCampaignDelivery_deviceId_fkey"
      FOREIGN KEY ("deviceId") REFERENCES "OwnerDevice"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- Version policy + support fields
ALTER TABLE "SystemSettings"
ADD COLUMN IF NOT EXISTS "ownerMobileLatestVersion" TEXT,
ADD COLUMN IF NOT EXISTS "ownerMobileMinimumVersion" TEXT,
ADD COLUMN IF NOT EXISTS "ownerMobileAndroidStoreUrl" TEXT,
ADD COLUMN IF NOT EXISTS "ownerMobileIosStoreUrl" TEXT,
ADD COLUMN IF NOT EXISTS "supportEmail" TEXT,
ADD COLUMN IF NOT EXISTS "supportWhatsAppNumber" TEXT,
ADD COLUMN IF NOT EXISTS "faqContentJson" TEXT,
ADD COLUMN IF NOT EXISTS "oneSignalAppId" TEXT,
ADD COLUMN IF NOT EXISTS "oneSignalApiKey" TEXT;
