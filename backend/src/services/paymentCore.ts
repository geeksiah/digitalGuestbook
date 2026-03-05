import { createHash, randomUUID } from 'crypto';
import type { PaymentIntent, PaymentIntentStatus, Prisma, Transaction } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import prisma from '../utils/prisma.js';
import { computeFees } from '../utils/fees.js';
import {
  fulfillGiftPurchase,
  fulfillTicketPurchase,
  fulfillVotePurchase,
  releaseTicketInventoryHolds,
} from './paymentFulfillment.js';
import { getPaymentAdapter } from './paymentAdapters/index.js';
import type { AdapterGatewayConfig, PaymentNextAction } from './paymentAdapters/types.js';

type EventFeeLike = {
  feeOverridesEnabled?: boolean | null;
  platformFeeMode?: string | null;
  platformFeePercent?: number | null;
  platformFeeFixed?: number | null;
  processingFeePercent?: number | null;
  processingFeeFixed?: number | null;
};

type CreatePaymentIntentInput = {
  eventId: string;
  purpose: 'TICKET' | 'GIFT' | 'VOTE' | 'USSD_CREDITS_TOPUP' | 'VOTE_PURCHASE';
  amount: number;
  currency?: string;
  paymentGatewayId: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

type CreatePaymentIntentResult = {
  intent: PaymentIntent;
  nextAction: PaymentNextAction;
};

type FinalizeParams = {
  intentId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'EXPIRED';
  providerTransactionId?: string;
  gatewayReference?: string;
};

type HandleWebhookInput = {
  gateway: string;
  payload: unknown;
  rawPayload?: string;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const toJsonString = (value: Record<string, unknown>) => JSON.stringify(value);

const parseIntentMetadata = (intent: PaymentIntent): Record<string, unknown> => {
  if (!intent.metadataJson) return {};
  try {
    return JSON.parse(intent.metadataJson) as Record<string, unknown>;
  } catch {
    return {};
  }
};

const buildIdempotencyKey = (input: CreatePaymentIntentInput, ownerId: string) => {
  const base = JSON.stringify({
    eventId: input.eventId,
    ownerId,
    purpose: input.purpose,
    amount: roundMoney(input.amount),
    currency: String(input.currency || '').toUpperCase(),
    paymentGatewayId: input.paymentGatewayId,
    metadata: input.metadata || {},
  });
  return createHash('sha256').update(base).digest('hex');
};

const resolveIntentFromWebhook = async (
  gateway: string,
  normalized: {
    gatewayReference?: string;
    providerTransactionId?: string;
    raw?: unknown;
  }
): Promise<PaymentIntent | null> => {
  const byReferenceCandidates = new Set<string>();
  if (normalized.gatewayReference) byReferenceCandidates.add(normalized.gatewayReference);
  if (normalized.providerTransactionId) byReferenceCandidates.add(normalized.providerTransactionId);

  for (const candidate of byReferenceCandidates) {
    const byReference = await prisma.paymentIntent.findFirst({
      where: {
        gateway,
        OR: [{ gatewayReference: candidate }, { id: candidate.replace(/^pi_/, '') }],
      },
    });
    if (byReference) return byReference;
  }

  const raw = (normalized.raw || {}) as Record<string, unknown>;
  let paymentIntentId: string | undefined;

  if (gateway === 'paystack') {
    const data = raw.data as Record<string, unknown> | undefined;
    const metadata = data?.metadata as Record<string, unknown> | undefined;
    if (typeof metadata?.paymentIntentId === 'string') paymentIntentId = metadata.paymentIntentId;
  }

  if (gateway === 'stripe') {
    const data = (raw.data as Record<string, unknown> | undefined)?.object as
      | Record<string, unknown>
      | undefined;
    if (typeof data?.client_reference_id === 'string') paymentIntentId = data.client_reference_id;
    if (!paymentIntentId && typeof data?.metadata === 'object' && data.metadata) {
      const metadata = data.metadata as Record<string, unknown>;
      if (typeof metadata.paymentIntentId === 'string') paymentIntentId = metadata.paymentIntentId;
    }
  }

  if (gateway === 'hubtel') {
    if (typeof raw.paymentIntentId === 'string') paymentIntentId = raw.paymentIntentId;
    if (!paymentIntentId && typeof raw.data === 'object' && raw.data) {
      const data = raw.data as Record<string, unknown>;
      if (typeof data.paymentIntentId === 'string') paymentIntentId = data.paymentIntentId;
    }
  }

  if (!paymentIntentId) return null;
  return prisma.paymentIntent.findUnique({ where: { id: paymentIntentId } });
};

const resolveGatewayConfig = async (gatewayId: string): Promise<AdapterGatewayConfig> => {
  const gateway = await prisma.paymentGateway.findFirst({
    where: {
      id: gatewayId,
      isActive: true,
    },
  });
  if (!gateway) throw new AppError('Payment gateway is not available', 400);
  return gateway as AdapterGatewayConfig;
};

const resolveGatewayConfigForIntent = async (intent: PaymentIntent): Promise<AdapterGatewayConfig> => {
  const metadata = parseIntentMetadata(intent);
  const paymentGatewayId =
    typeof metadata.paymentGatewayId === 'string' ? metadata.paymentGatewayId : null;
  if (paymentGatewayId) {
    return resolveGatewayConfig(paymentGatewayId);
  }

  const gateway = await prisma.paymentGateway.findFirst({
    where: {
      gateway: intent.gateway,
      isActive: true,
    },
    orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
  });

  if (!gateway) {
    throw new AppError(`Gateway config for ${intent.gateway} not found`, 400);
  }

  return gateway as AdapterGatewayConfig;
};

export const createPaymentIntent = async (
  input: CreatePaymentIntentInput
): Promise<CreatePaymentIntentResult> => {
  const amount = roundMoney(Number(input.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError('Payment amount must be greater than zero', 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      ownerId: true,
      defaultCurrency: true,
      feeOverridesEnabled: true,
      platformFeeMode: true,
      platformFeePercent: true,
      platformFeeFixed: true,
      processingFeePercent: true,
      processingFeeFixed: true,
      eventPaymentGateways: {
        where: {
          paymentGatewayId: input.paymentGatewayId,
          isActive: true,
          paymentGateway: {
            isActive: true,
          },
        },
        include: {
          paymentGateway: true,
        },
      },
    },
  });

  if (!event) throw new AppError('Event not found', 404);
  if (!event.ownerId) throw new AppError('Event owner is not configured', 400);

  const eventGateway = event.eventPaymentGateways[0];
  if (!eventGateway) throw new AppError('Selected payment gateway is not enabled for this event', 400);

  const selectedGateway = eventGateway.paymentGateway as AdapterGatewayConfig;
  const gatewayType = String(selectedGateway.gateway || '').toLowerCase();
  const currency = String(input.currency || selectedGateway.currency || event.defaultCurrency || 'USD').toUpperCase();

  const feeConfigEvent: EventFeeLike = {
    feeOverridesEnabled: event.feeOverridesEnabled,
    platformFeeMode: event.platformFeeMode,
    platformFeePercent: event.platformFeePercent,
    platformFeeFixed: event.platformFeeFixed,
    processingFeePercent: event.processingFeePercent,
    processingFeeFixed: event.processingFeeFixed,
  };

  const fees = await computeFees(amount, feeConfigEvent);
  const chargeAmount = roundMoney(amount + fees.platformFeeAmount + fees.processingEstimate);
  const idempotencyKey = input.idempotencyKey || buildIdempotencyKey(input, event.ownerId);
  const metadataPayload = {
    ...(input.metadata || {}),
    paymentGatewayId: selectedGateway.id,
    baseAmount: amount,
    processingEstimate: fees.processingEstimate,
  };

  let intent: PaymentIntent;
  try {
    intent = await prisma.paymentIntent.create({
      data: {
        eventId: event.id,
        ownerId: event.ownerId,
        purpose: input.purpose,
        gateway: gatewayType,
        amount: chargeAmount,
        currency,
        status: 'PENDING',
        platformFeeAmount: fees.platformFeeAmount,
        organizerAmount: fees.organizerAmount,
        metadataJson: toJsonString(metadataPayload),
        idempotencyKey,
      },
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;
    const existing = await prisma.paymentIntent.findUnique({
      where: { idempotencyKey },
    });
    if (!existing) throw error;
    intent = existing;
  }

  const adapter = getPaymentAdapter(gatewayType);
  const adapterIntent = {
    id: intent.id,
    eventId: intent.eventId,
    purpose: intent.purpose,
    amount: intent.amount,
    currency: intent.currency,
    metadata: metadataPayload,
  } as const;

  let nextAction: PaymentNextAction = { type: 'NONE', reference: intent.gatewayReference || undefined };
  if (!intent.gatewayReference || intent.status === 'PENDING') {
    const initialized = await adapter.initializePayment(adapterIntent, selectedGateway);
    intent = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: 'INITIALIZED',
        gatewayReference: initialized.gatewayReference,
      },
    });
    nextAction = initialized.nextAction;
  }

  return { intent, nextAction };
};

export const verifyGatewayTransaction = async (intentId: string, reference?: string) => {
  const intent = await prisma.paymentIntent.findUnique({ where: { id: intentId } });
  if (!intent) throw new AppError('Payment intent not found', 404);

  const gatewayConfig = await resolveGatewayConfigForIntent(intent);
  const adapter = getPaymentAdapter(intent.gateway);
  const targetReference = String(reference || intent.gatewayReference || '').trim();
  if (!targetReference) throw new AppError('Payment reference is required for verification', 400);

  const verified = await adapter.verifyTransaction(targetReference, gatewayConfig);
  if (verified.status === 'SUCCEEDED') {
    await finalizePaymentIntent({
      intentId: intent.id,
      status: 'SUCCEEDED',
      providerTransactionId: verified.providerTransactionId,
      gatewayReference: verified.gatewayReference || targetReference,
    });
  }

  if (verified.status === 'FAILED') {
    await finalizePaymentIntent({
      intentId: intent.id,
      status: 'FAILED',
      providerTransactionId: verified.providerTransactionId,
      gatewayReference: verified.gatewayReference || targetReference,
    });
  }

  return verified;
};

export const createTransaction = async (
  intent: PaymentIntent,
  providerTransactionId: string
): Promise<Transaction> => {
  const normalizedProviderId = String(providerTransactionId || intent.gatewayReference || randomUUID()).trim();
  if (!normalizedProviderId) {
    throw new AppError('Provider transaction id is required', 400);
  }

  try {
    return await prisma.transaction.create({
      data: {
        paymentIntentId: intent.id,
        eventId: intent.eventId,
        ownerId: intent.ownerId,
        gateway: intent.gateway,
        grossAmount: intent.amount,
        platformFeeAmount: intent.platformFeeAmount,
        organizerAmount: intent.organizerAmount,
        currency: intent.currency,
        providerTransactionId: normalizedProviderId,
        status: 'COMPLETED',
      },
    });
  } catch (error: any) {
    if (error?.code !== 'P2002') throw error;
    const existingByIntent = await prisma.transaction.findUnique({
      where: { paymentIntentId: intent.id },
    });
    if (existingByIntent) return existingByIntent;
    const existingByProvider = await prisma.transaction.findUnique({
      where: { providerTransactionId: normalizedProviderId },
    });
    if (existingByProvider) return existingByProvider;
    throw error;
  }
};

export const callFulfillmentHandler = async (intent: PaymentIntent, tx: Transaction) => {
  if (intent.purpose === 'TICKET') {
    await fulfillTicketPurchase(intent, tx);
    return;
  }
  if (intent.purpose === 'GIFT') {
    await fulfillGiftPurchase(intent, tx);
    return;
  }
  if (intent.purpose === 'VOTE') {
    await fulfillVotePurchase(intent, tx);
    return;
  }
  if (intent.purpose === 'USSD_CREDITS_TOPUP' || intent.purpose === 'VOTE_PURCHASE') {
    return;
  }
  throw new AppError(`Unsupported payment intent purpose: ${intent.purpose}`, 400);
};

export const finalizePaymentIntent = async (params: FinalizeParams) => {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: params.intentId },
  });
  if (!intent) throw new AppError('Payment intent not found', 404);

  if (params.status === 'FAILED' || params.status === 'EXPIRED') {
    if (intent.status !== 'SUCCEEDED') {
      const mappedStatus: PaymentIntentStatus = params.status === 'FAILED' ? 'FAILED' : 'EXPIRED';
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: mappedStatus,
          gatewayReference: params.gatewayReference || intent.gatewayReference,
        },
      });
    }
    await releaseTicketInventoryHolds(intent.id, params.status === 'EXPIRED' ? 'EXPIRED' : 'RELEASED');
    return { intent, transaction: null };
  }

  const updatedIntent = await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: 'SUCCEEDED',
      gatewayReference: params.gatewayReference || intent.gatewayReference,
    },
  });

  const transaction = await createTransaction(
    updatedIntent,
    params.providerTransactionId || params.gatewayReference || updatedIntent.gatewayReference || updatedIntent.id
  );
  await callFulfillmentHandler(updatedIntent, transaction);

  return { intent: updatedIntent, transaction };
};

export const handleWebhook = async (input: HandleWebhookInput) => {
  const gateway = String(input.gateway || '').toLowerCase();
  const adapter = getPaymentAdapter(gateway);

  const gatewayConfig = (await prisma.paymentGateway.findFirst({
    where: {
      gateway,
      isActive: true,
    },
    orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
  })) as AdapterGatewayConfig | null;

  if (!gatewayConfig) {
    throw new AppError(`No active ${gateway} gateway config found`, 400);
  }

  const normalized = await adapter.handleWebhook(input.payload, gatewayConfig);
  const payloadString = input.rawPayload || JSON.stringify(input.payload || {});

  const existingWebhook = await prisma.paymentWebhookEvent.findUnique({
    where: { eventKey: normalized.eventKey },
  });
  if (existingWebhook) {
    return {
      received: true,
      duplicate: true,
      status: normalized.status,
    };
  }

  const resolvedIntent = await resolveIntentFromWebhook(gateway, normalized);
  await prisma.paymentWebhookEvent.create({
    data: {
      eventId: resolvedIntent?.eventId || null,
      gateway,
      eventType: normalized.eventType,
      eventKey: normalized.eventKey,
      payload: payloadString.slice(0, 100000),
      processedAt: new Date(),
    },
  });

  if (!resolvedIntent || normalized.status === 'IGNORED') {
    return {
      received: true,
      status: normalized.status,
      paymentIntentId: resolvedIntent?.id || null,
    };
  }

  if (normalized.status === 'SUCCEEDED') {
    await finalizePaymentIntent({
      intentId: resolvedIntent.id,
      status: 'SUCCEEDED',
      providerTransactionId:
        normalized.providerTransactionId || normalized.gatewayReference || resolvedIntent.gatewayReference || resolvedIntent.id,
      gatewayReference: normalized.gatewayReference || resolvedIntent.gatewayReference || undefined,
    });
  } else if (normalized.status === 'FAILED') {
    await finalizePaymentIntent({
      intentId: resolvedIntent.id,
      status: 'FAILED',
      providerTransactionId: normalized.providerTransactionId,
      gatewayReference: normalized.gatewayReference || resolvedIntent.gatewayReference || undefined,
    });
  }

  return {
    received: true,
    status: normalized.status,
    paymentIntentId: resolvedIntent.id,
  };
};
