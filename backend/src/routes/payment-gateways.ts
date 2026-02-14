import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// ============================================
// PAYMENT GATEWAY SCHEMA
// ============================================

const paymentGatewaySchema = z.object({
  name: z.string().min(1).max(100),
  gateway: z.enum([
    'stripe',
    'paystack',
    'flutterwave',
    'paypal',
    'mtn_momo',
    'telecel_cash',
    'airteltigo_cash',
    'custom',
  ]),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  isLive: z.boolean().default(false),
  // Stripe
  stripePublicKey: z.string().optional(),
  stripeSecretKey: z.string().optional(),
  stripeWebhookSecret: z.string().optional(),
  // Paystack
  paystackPublicKey: z.string().optional(),
  paystackSecretKey: z.string().optional(),
  // Flutterwave
  flutterwavePublicKey: z.string().optional(),
  flutterwaveSecretKey: z.string().optional(),
  // MTN MoMo
  mtnMomoApiKey: z.string().optional(),
  mtnMomoApiSecret: z.string().optional(),
  mtnMomoSubscriptionKey: z.string().optional(),
  mtnMomoEnvironment: z.enum(['sandbox', 'production']).optional(),
  // Telecel Cash
  telecelCashApiKey: z.string().optional(),
  telecelCashApiSecret: z.string().optional(),
  telecelCashMerchantId: z.string().optional(),
  // Airteltigo Cash
  airteltigoCashApiKey: z.string().optional(),
  airteltigoCashApiSecret: z.string().optional(),
  airteltigoCashMerchantId: z.string().optional(),
  // Custom Gateway
  customGatewayName: z.string().optional(),
  customGatewayApiUrl: z.string().optional(),
  customGatewayApiKey: z.string().optional(),
  customGatewayApiSecret: z.string().optional(),
  customGatewayConfig: z.string().optional(),
  // Common
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a 3-letter ISO code')
    .transform((value) => value.toUpperCase())
    .default('USD'),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

// ============================================
// SYSTEM-WIDE PAYMENT GATEWAY MANAGEMENT
// ============================================

/**
 * GET /api/payment-gateways
 * Get all system-wide payment gateways
 */
router.get('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const gateways = await prisma.paymentGateway.findMany({
    orderBy: { createdAt: 'desc' },
  });

  // Mask sensitive keys
  const masked = gateways.map((g: any) => {
    if (g.stripeSecretKey) g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
    if (g.stripeWebhookSecret) g.stripeWebhookSecret = '****';
    if (g.paystackSecretKey) g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
    if (g.flutterwaveSecretKey) g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
    if (g.mtnMomoApiSecret) g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
    if (g.telecelCashApiSecret) g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
    if (g.airteltigoCashApiSecret) g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
    if (g.customGatewayApiSecret) g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
    return g;
  });

  res.json({ gateways: masked });
}));

/**
 * GET /api/payment-gateways/:id
 * Get a specific payment gateway
 */
router.get('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const gateway = await prisma.paymentGateway.findUnique({
    where: { id },
    include: {
      events: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!gateway) {
    throw new AppError('Payment gateway not found', 404);
  }

  // Mask sensitive keys
  const masked: any = { ...gateway };
  if (masked.stripeSecretKey) masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
  if (masked.stripeWebhookSecret) masked.stripeWebhookSecret = '****';
  if (masked.paystackSecretKey) masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
  if (masked.flutterwaveSecretKey) masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
  if (masked.mtnMomoApiSecret) masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
  if (masked.telecelCashApiSecret) masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
  if (masked.airteltigoCashApiSecret) masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
  if (masked.customGatewayApiSecret) masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);

  res.json({ gateway: masked });
}));

/**
 * POST /api/payment-gateways
 * Create a new system-wide payment gateway
 */
router.post('/', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = paymentGatewaySchema.parse(req.body);

  // Don't overwrite masked values if updating
  const cleanData = { ...data };
  if (cleanData.stripeSecretKey?.startsWith('****')) delete cleanData.stripeSecretKey;
  if (cleanData.stripeWebhookSecret === '****') delete cleanData.stripeWebhookSecret;
  if (cleanData.paystackSecretKey?.startsWith('****')) delete cleanData.paystackSecretKey;
  if (cleanData.flutterwaveSecretKey?.startsWith('****')) delete cleanData.flutterwaveSecretKey;
  if (cleanData.mtnMomoApiSecret?.startsWith('****')) delete cleanData.mtnMomoApiSecret;
  if (cleanData.telecelCashApiSecret?.startsWith('****')) delete cleanData.telecelCashApiSecret;
  if (cleanData.airteltigoCashApiSecret?.startsWith('****')) delete cleanData.airteltigoCashApiSecret;
  if (cleanData.customGatewayApiSecret?.startsWith('****')) delete cleanData.customGatewayApiSecret;

  const gateway = await prisma.paymentGateway.create({
    data: cleanData,
  });

  // Mask sensitive keys in response
  const masked: any = { ...gateway };
  if (masked.stripeSecretKey) masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
  if (masked.stripeWebhookSecret) masked.stripeWebhookSecret = '****';
  if (masked.paystackSecretKey) masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
  if (masked.flutterwaveSecretKey) masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
  if (masked.mtnMomoApiSecret) masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
  if (masked.telecelCashApiSecret) masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
  if (masked.airteltigoCashApiSecret) masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
  if (masked.customGatewayApiSecret) masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);

  res.status(201).json({ gateway: masked });
}));

/**
 * PUT /api/payment-gateways/:id
 * Update a payment gateway
 */
router.put('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = paymentGatewaySchema.partial().parse(req.body);

  const existing = await prisma.paymentGateway.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError('Payment gateway not found', 404);
  }

  // Don't overwrite masked values
  const cleanData = { ...data };
  if (cleanData.stripeSecretKey?.startsWith('****')) delete cleanData.stripeSecretKey;
  if (cleanData.stripeWebhookSecret === '****') delete cleanData.stripeWebhookSecret;
  if (cleanData.paystackSecretKey?.startsWith('****')) delete cleanData.paystackSecretKey;
  if (cleanData.flutterwaveSecretKey?.startsWith('****')) delete cleanData.flutterwaveSecretKey;
  if (cleanData.mtnMomoApiSecret?.startsWith('****')) delete cleanData.mtnMomoApiSecret;
  if (cleanData.telecelCashApiSecret?.startsWith('****')) delete cleanData.telecelCashApiSecret;
  if (cleanData.airteltigoCashApiSecret?.startsWith('****')) delete cleanData.airteltigoCashApiSecret;
  if (cleanData.customGatewayApiSecret?.startsWith('****')) delete cleanData.customGatewayApiSecret;

  const gateway = await prisma.paymentGateway.update({
    where: { id },
    data: cleanData,
  });

  // Mask sensitive keys in response
  const masked: any = { ...gateway };
  if (masked.stripeSecretKey) masked.stripeSecretKey = '****' + masked.stripeSecretKey.slice(-4);
  if (masked.stripeWebhookSecret) masked.stripeWebhookSecret = '****';
  if (masked.paystackSecretKey) masked.paystackSecretKey = '****' + masked.paystackSecretKey.slice(-4);
  if (masked.flutterwaveSecretKey) masked.flutterwaveSecretKey = '****' + masked.flutterwaveSecretKey.slice(-4);
  if (masked.mtnMomoApiSecret) masked.mtnMomoApiSecret = '****' + masked.mtnMomoApiSecret.slice(-4);
  if (masked.telecelCashApiSecret) masked.telecelCashApiSecret = '****' + masked.telecelCashApiSecret.slice(-4);
  if (masked.airteltigoCashApiSecret) masked.airteltigoCashApiSecret = '****' + masked.airteltigoCashApiSecret.slice(-4);
  if (masked.customGatewayApiSecret) masked.customGatewayApiSecret = '****' + masked.customGatewayApiSecret.slice(-4);

  res.json({ gateway: masked });
}));

/**
 * DELETE /api/payment-gateways/:id
 * Delete a payment gateway (only if not used by any events)
 */
router.delete('/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if gateway is used by any events
  const usage = await prisma.eventPaymentGateway.count({
    where: { paymentGatewayId: id },
  });

  if (usage > 0) {
    throw new AppError(
      `Cannot delete payment gateway: it is currently used by ${usage} event(s). Remove it from all events first.`,
      400
    );
  }

  await prisma.paymentGateway.delete({
    where: { id },
  });

  res.json({ message: 'Payment gateway deleted' });
}));

// ============================================
// EVENT-SPECIFIC GATEWAY SELECTION
// ============================================

/**
 * GET /api/payment-gateways/events/:eventId
 * Get payment gateways enabled for an event
 */
router.get('/events/:eventId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const eventGateways = await prisma.eventPaymentGateway.findMany({
    where: { eventId },
    include: {
      paymentGateway: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  // Mask sensitive keys
  const masked = eventGateways.map((eg: any) => {
    const g = eg.paymentGateway;
    if (g.stripeSecretKey) g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
    if (g.stripeWebhookSecret) g.stripeWebhookSecret = '****';
    if (g.paystackSecretKey) g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
    if (g.flutterwaveSecretKey) g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
    if (g.mtnMomoApiSecret) g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
    if (g.telecelCashApiSecret) g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
    if (g.airteltigoCashApiSecret) g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
    if (g.customGatewayApiSecret) g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
    return eg;
  });

  res.json({ eventGateways: masked });
}));

/**
 * PUT /api/payment-gateways/events/:eventId
 * Update payment gateways for an event (replace all)
 */
router.put('/events/:eventId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { gatewayIds } = req.body; // Array of { paymentGatewayId, isActive, sortOrder }

  if (!Array.isArray(gatewayIds)) {
    throw new AppError('gatewayIds must be an array', 400);
  }

  // Verify event exists
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Delete existing event gateway associations
  await prisma.eventPaymentGateway.deleteMany({
    where: { eventId },
  });

  // Create new associations
  const eventGateways = await Promise.all(
    gatewayIds.map((item: any, index: number) =>
      prisma.eventPaymentGateway.create({
        data: {
          eventId,
          paymentGatewayId: item.paymentGatewayId || item.id,
          isActive: item.isActive !== false,
          sortOrder: item.sortOrder !== undefined ? item.sortOrder : index,
        },
        include: {
          paymentGateway: true,
        },
      })
    )
  );

  // Mask sensitive keys
  const masked = eventGateways.map((eg: any) => {
    const g = eg.paymentGateway;
    if (g.stripeSecretKey) g.stripeSecretKey = '****' + g.stripeSecretKey.slice(-4);
    if (g.stripeWebhookSecret) g.stripeWebhookSecret = '****';
    if (g.paystackSecretKey) g.paystackSecretKey = '****' + g.paystackSecretKey.slice(-4);
    if (g.flutterwaveSecretKey) g.flutterwaveSecretKey = '****' + g.flutterwaveSecretKey.slice(-4);
    if (g.mtnMomoApiSecret) g.mtnMomoApiSecret = '****' + g.mtnMomoApiSecret.slice(-4);
    if (g.telecelCashApiSecret) g.telecelCashApiSecret = '****' + g.telecelCashApiSecret.slice(-4);
    if (g.airteltigoCashApiSecret) g.airteltigoCashApiSecret = '****' + g.airteltigoCashApiSecret.slice(-4);
    if (g.customGatewayApiSecret) g.customGatewayApiSecret = '****' + g.customGatewayApiSecret.slice(-4);
    return eg;
  });

  res.json({ eventGateways: masked });
}));

export default router;

