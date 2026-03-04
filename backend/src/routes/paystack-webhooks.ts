import { Router } from 'express';
import { createHash } from 'crypto';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { verifyPaystackWebhookSignature } from '../services/paystack.js';
import { reconcilePaystackTransfer } from '../services/payoutAutomation.js';
import { handleWebhook as handlePaymentWebhook } from '../services/paymentCore.js';

const router = Router();
const db = prisma as any;

router.get('/health', (_req, res) => {
  res.json({ ok: true, provider: 'paystack' });
});

router.post('/', asyncHandler(async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {}), 'utf8');
  const rawPayload = rawBody.toString('utf8');
  const signature = req.get('x-paystack-signature');

  const validSignature = await verifyPaystackWebhookSignature(rawBody, signature);
  if (!validSignature) {
    throw new AppError('Invalid Paystack webhook signature', 401);
  }

  let payload: any;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    throw new AppError('Invalid webhook payload', 400);
  }

  const eventName = String(payload?.event || 'unknown');
  const transferCode = payload?.data?.transfer_code ? String(payload.data.transfer_code) : null;
  const reference = payload?.data?.reference ? String(payload.data.reference) : null;
  const baseKey = `${eventName}:${transferCode || ''}:${reference || ''}:${rawPayload.slice(0, 512)}`;
  const dedupeKey = createHash('sha256').update(baseKey).digest('hex');

  const duplicate = await db.paystackWebhookEvent.findUnique({
    where: { dedupeKey },
    select: { id: true },
  });
  if (duplicate) {
    return res.json({ received: true, duplicate: true });
  }

  const webhookLog = await db.paystackWebhookEvent.create({
    data: {
      dedupeKey,
      event: eventName,
      reference,
      transferCode,
      payload: rawPayload.slice(0, 100000),
    },
  });

  if (eventName.toLowerCase().startsWith('transfer.')) {
    await reconcilePaystackTransfer({
      eventName,
      payload,
      rawPayload,
    });
  } else {
    await handlePaymentWebhook({
      gateway: 'paystack',
      payload,
      rawPayload,
    });
  }

  await db.paystackWebhookEvent.update({
    where: { id: webhookLog.id },
    data: { processedAt: new Date() },
  });

  res.json({ received: true });
}));

export default router;
