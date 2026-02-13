-- Additive schema updates for payout automation + flexible platform fees
-- Safe for production (non-destructive)

-- Event fee mode/fixed fee support
ALTER TABLE "Event"
ADD COLUMN IF NOT EXISTS "platformFeeMode" TEXT NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN IF NOT EXISTS "platformFeeFixed" DOUBLE PRECISION;

-- Owner wallet payout recipient details
ALTER TABLE "OwnerWallet"
ADD COLUMN IF NOT EXISTS "paystackRecipientCode" TEXT,
ADD COLUMN IF NOT EXISTS "paystackRecipientType" TEXT,
ADD COLUMN IF NOT EXISTS "paystackRecipientName" TEXT,
ADD COLUMN IF NOT EXISTS "paystackRecipientBankCode" TEXT,
ADD COLUMN IF NOT EXISTS "paystackRecipientUpdatedAt" TIMESTAMP(3);

-- Payout request ledger and reconciliation fields
ALTER TABLE "PayoutRequest"
ADD COLUMN IF NOT EXISTS "ledgerStatus" TEXT NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN IF NOT EXISTS "payoutReference" TEXT,
ADD COLUMN IF NOT EXISTS "gateway" TEXT,
ADD COLUMN IF NOT EXISTS "gatewayTransferCode" TEXT,
ADD COLUMN IF NOT EXISTS "gatewayTransferReference" TEXT,
ADD COLUMN IF NOT EXISTS "gatewayRecipientCode" TEXT,
ADD COLUMN IF NOT EXISTS "gatewayStatus" TEXT,
ADD COLUMN IF NOT EXISTS "reconciliationVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "webhookLastEvent" TEXT,
ADD COLUMN IF NOT EXISTS "webhookLastPayload" TEXT,
ADD COLUMN IF NOT EXISTS "failureCode" TEXT,
ADD COLUMN IF NOT EXISTS "failureMessage" TEXT,
ADD COLUMN IF NOT EXISTS "reconciledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "requestedByOwnerId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_payoutReference_key"
  ON "PayoutRequest"("payoutReference");

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_gatewayTransferCode_key"
  ON "PayoutRequest"("gatewayTransferCode");

CREATE UNIQUE INDEX IF NOT EXISTS "PayoutRequest_gatewayTransferReference_key"
  ON "PayoutRequest"("gatewayTransferReference");

-- Webhook idempotency and audit log table for Paystack events
CREATE TABLE IF NOT EXISTS "PaystackWebhookEvent" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "reference" TEXT,
  "transferCode" TEXT,
  "payload" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaystackWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaystackWebhookEvent_dedupeKey_key"
  ON "PaystackWebhookEvent"("dedupeKey");

CREATE INDEX IF NOT EXISTS "PaystackWebhookEvent_event_idx"
  ON "PaystackWebhookEvent"("event");

CREATE INDEX IF NOT EXISTS "PaystackWebhookEvent_reference_idx"
  ON "PaystackWebhookEvent"("reference");

CREATE INDEX IF NOT EXISTS "PaystackWebhookEvent_transferCode_idx"
  ON "PaystackWebhookEvent"("transferCode");

