import { createHmac, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { verifyPaystackWebhookSignature } from '../services/paystack.js';
import { handleWebhook as handlePaymentWebhook } from '../services/paymentCore.js';
import { reconcilePaystackTransfer } from '../services/payoutAutomation.js';
import prisma from '../utils/prisma.js';

const router = Router();

const getRawPayload = (body: unknown) => {
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string') return body;
  return JSON.stringify(body || {});
};

const parsePayload = (rawPayload: string) => {
  try {
    return JSON.parse(rawPayload) as unknown;
  } catch {
    throw new AppError('Invalid webhook JSON payload', 400);
  }
};

const verifyStripeSignature = async (rawPayload: string, signatureHeader: string | undefined) => {
  const provided = String(signatureHeader || '').trim();
  if (!provided) return false;

  const stripeGateway = await prisma.paymentGateway.findFirst({
    where: {
      gateway: 'stripe',
      isActive: true,
    },
    orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    select: { stripeWebhookSecret: true },
  });
  const secret = String(stripeGateway?.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new AppError('Stripe webhook secret is not configured', 400);

  const parts = provided.split(',').map((entry) => entry.trim());
  const timestampPart = parts.find((entry) => entry.startsWith('t='));
  const v1Part = parts.find((entry) => entry.startsWith('v1='));
  if (!timestampPart || !v1Part) return false;

  const timestamp = timestampPart.slice(2);
  const receivedSignature = v1Part.slice(3);
  const payloadToSign = `${timestamp}.${rawPayload}`;
  const computed = createHmac('sha256', secret).update(payloadToSign).digest('hex');

  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedSignature));
  } catch {
    return false;
  }
};

const verifyHubtelSignature = async (rawPayload: string, signatureHeader: string | undefined) => {
  const provided = String(signatureHeader || '').trim();
  if (!provided) return false;

  const hubtelGateway = await prisma.paymentGateway.findFirst({
    where: {
      gateway: 'hubtel',
      isActive: true,
    },
    orderBy: [{ isLive: 'desc' }, { updatedAt: 'desc' }],
    select: {
      hubtelWebhookSecret: true,
    },
  });
  const secret = String(hubtelGateway?.hubtelWebhookSecret || process.env.HUBTEL_WEBHOOK_SECRET || '').trim();
  if (!secret) throw new AppError('Hubtel webhook secret is not configured', 400);

  const computed = createHmac('sha256', secret).update(rawPayload).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(provided));
  } catch {
    return false;
  }
};

router.post(
  '/paystack',
  asyncHandler(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('x-paystack-signature');
    const valid = await verifyPaystackWebhookSignature(Buffer.from(rawPayload, 'utf8'), signature);
    if (!valid) throw new AppError('Invalid Paystack webhook signature', 401);

    const payload = parsePayload(rawPayload);
    const eventName = String((payload as any)?.event || '');
    if (eventName.toLowerCase().startsWith('transfer.')) {
      await reconcilePaystackTransfer({
        eventName,
        payload,
        rawPayload,
      });
    }
    const result = await handlePaymentWebhook({
      gateway: 'paystack',
      payload,
      rawPayload,
    });
    res.json(result);
  })
);

router.post(
  '/stripe',
  asyncHandler(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('stripe-signature');
    const valid = await verifyStripeSignature(rawPayload, signature || undefined);
    if (!valid) throw new AppError('Invalid Stripe webhook signature', 401);

    const payload = parsePayload(rawPayload);
    const result = await handlePaymentWebhook({
      gateway: 'stripe',
      payload,
      rawPayload,
    });
    res.json(result);
  })
);

router.post(
  '/hubtel',
  asyncHandler(async (req, res) => {
    const rawPayload = getRawPayload(req.body);
    const signature = req.get('x-hubtel-signature');
    const valid = await verifyHubtelSignature(rawPayload, signature || undefined);
    if (!valid) throw new AppError('Invalid Hubtel webhook signature', 401);

    const payload = parsePayload(rawPayload);
    const result = await handlePaymentWebhook({
      gateway: 'hubtel',
      payload,
      rawPayload,
    });
    res.json(result);
  })
);

export default router;
