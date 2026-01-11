import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// ============================================
// CUSTOM FORM FIELDS
// ============================================

const formFieldSchema = z.object({
  fieldName: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  type: z.enum(['text', 'email', 'phone', 'number', 'select', 'checkbox', 'radio', 'textarea', 'date']),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(false),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
  showOnConfirmation: z.boolean().default(true),
});

/**
 * GET /api/ticketing/events/:eventId/fields
 * Get all custom form fields for an event
 */
router.get('/events/:eventId/fields', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const fields = await prisma.eventFormField.findMany({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ fields });
}));

/**
 * POST /api/ticketing/events/:eventId/fields
 * Create a new custom form field
 */
router.post('/events/:eventId/fields', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const data = formFieldSchema.parse(req.body);

  // Convert options array to JSON string
  const field = await prisma.eventFormField.create({
    data: {
      eventId,
      ...data,
      options: data.options ? JSON.stringify(data.options) : null,
    },
  });

  res.status(201).json({ field });
}));

/**
 * PUT /api/ticketing/events/:eventId/fields/:fieldId
 * Update a custom form field
 */
router.put('/events/:eventId/fields/:fieldId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId, fieldId } = req.params;
  const data = formFieldSchema.partial().parse(req.body);

  const field = await prisma.eventFormField.update({
    where: { id: fieldId, eventId },
    data: {
      ...data,
      options: data.options ? JSON.stringify(data.options) : undefined,
    },
  });

  res.json({ field });
}));

/**
 * DELETE /api/ticketing/events/:eventId/fields/:fieldId
 * Delete a custom form field
 */
router.delete('/events/:eventId/fields/:fieldId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId, fieldId } = req.params;

  await prisma.eventFormField.delete({
    where: { id: fieldId, eventId },
  });

  res.json({ message: 'Field deleted' });
}));

/**
 * PUT /api/ticketing/events/:eventId/fields/reorder
 * Reorder custom form fields
 */
router.put('/events/:eventId/fields/reorder', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const { fieldIds } = req.body;

  if (!Array.isArray(fieldIds)) {
    throw new AppError('fieldIds must be an array', 400);
  }

  // Update sort order for each field
  await Promise.all(
    fieldIds.map((id: string, index: number) =>
      prisma.eventFormField.update({
        where: { id, eventId },
        data: { sortOrder: index },
      })
    )
  );

  res.json({ message: 'Fields reordered' });
}));

// ============================================
// TICKET TYPES
// ============================================

const ticketTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  quantityTotal: z.number().min(0).default(0),
  maxPerOrder: z.number().min(1).default(10),
  saleStartDate: z.string().datetime().optional(),
  saleEndDate: z.string().datetime().optional(),
  sortOrder: z.number().default(0),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/ticketing/events/:eventId/tickets
 * Get all ticket types for an event
 */
router.get('/events/:eventId/tickets', asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const tickets = await prisma.ticketType.findMany({
    where: { eventId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ tickets });
}));

/**
 * GET /api/ticketing/events/:eventId/tickets/admin
 * Get all ticket types for an event (admin - includes inactive)
 */
router.get('/events/:eventId/tickets/admin', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const tickets = await prisma.ticketType.findMany({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ tickets });
}));

/**
 * POST /api/ticketing/events/:eventId/tickets
 * Create a new ticket type
 */
router.post('/events/:eventId/tickets', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const data = ticketTypeSchema.parse(req.body);

  const ticket = await prisma.ticketType.create({
    data: {
      eventId,
      ...data,
      saleStartDate: data.saleStartDate ? new Date(data.saleStartDate) : null,
      saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : null,
    },
  });

  res.status(201).json({ ticket });
}));

/**
 * PUT /api/ticketing/events/:eventId/tickets/:ticketId
 * Update a ticket type
 */
router.put('/events/:eventId/tickets/:ticketId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId, ticketId } = req.params;
  const data = ticketTypeSchema.partial().parse(req.body);

  const ticket = await prisma.ticketType.update({
    where: { id: ticketId, eventId },
    data: {
      ...data,
      saleStartDate: data.saleStartDate ? new Date(data.saleStartDate) : undefined,
      saleEndDate: data.saleEndDate ? new Date(data.saleEndDate) : undefined,
    },
  });

  res.json({ ticket });
}));

/**
 * DELETE /api/ticketing/events/:eventId/tickets/:ticketId
 * Delete a ticket type
 */
router.delete('/events/:eventId/tickets/:ticketId', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId, ticketId } = req.params;

  await prisma.ticketType.delete({
    where: { id: ticketId, eventId },
  });

  res.json({ message: 'Ticket type deleted' });
}));

// ============================================
// PAYMENT GATEWAY CONFIGURATION
// ============================================

const paymentGatewaySchema = z.object({
  gateway: z.enum([
    'stripe', 
    'paystack', 
    'flutterwave', 
    'paypal', 
    'mtn_momo', 
    'telecel_cash', 
    'airteltigo_cash', 
    'custom',
    'free'
  ]),
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
  customGatewayConfig: z.string().optional(), // JSON string for additional config
  // Common
  currency: z.string().default('USD'),
  successUrl: z.string().optional(),
  cancelUrl: z.string().optional(),
});

/**
 * GET /api/ticketing/events/:eventId/payment
 * Get payment gateway configuration for an event
 */
router.get('/events/:eventId/payment', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const gateway = await prisma.paymentGateway.findUnique({
    where: { eventId },
  });

  // Mask sensitive keys
  if (gateway) {
    if (gateway.stripeSecretKey) gateway.stripeSecretKey = '****' + gateway.stripeSecretKey.slice(-4);
    if (gateway.stripeWebhookSecret) gateway.stripeWebhookSecret = '****';
    if (gateway.paystackSecretKey) gateway.paystackSecretKey = '****' + gateway.paystackSecretKey.slice(-4);
    if (gateway.flutterwaveSecretKey) gateway.flutterwaveSecretKey = '****' + gateway.flutterwaveSecretKey.slice(-4);
    if (gateway.mtnMomoApiSecret) gateway.mtnMomoApiSecret = '****' + gateway.mtnMomoApiSecret.slice(-4);
    if (gateway.telecelCashApiSecret) gateway.telecelCashApiSecret = '****' + gateway.telecelCashApiSecret.slice(-4);
    if (gateway.airteltigoCashApiSecret) gateway.airteltigoCashApiSecret = '****' + gateway.airteltigoCashApiSecret.slice(-4);
    if (gateway.customGatewayApiSecret) gateway.customGatewayApiSecret = '****' + gateway.customGatewayApiSecret.slice(-4);
  }

  res.json({ gateway });
}));

/**
 * PUT /api/ticketing/events/:eventId/payment
 * Configure payment gateway for an event
 */
router.put('/events/:eventId/payment', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const data = paymentGatewaySchema.parse(req.body);

  // Don't overwrite masked values
  const existing = await prisma.paymentGateway.findUnique({ where: { eventId } });
  
  const cleanData = { ...data };
  // Don't overwrite masked secret values
  if (cleanData.stripeSecretKey?.startsWith('****')) delete cleanData.stripeSecretKey;
  if (cleanData.stripeWebhookSecret === '****') delete cleanData.stripeWebhookSecret;
  if (cleanData.paystackSecretKey?.startsWith('****')) delete cleanData.paystackSecretKey;
  if (cleanData.flutterwaveSecretKey?.startsWith('****')) delete cleanData.flutterwaveSecretKey;
  if (cleanData.mtnMomoApiSecret?.startsWith('****')) delete cleanData.mtnMomoApiSecret;
  if (cleanData.telecelCashApiSecret?.startsWith('****')) delete cleanData.telecelCashApiSecret;
  if (cleanData.airteltigoCashApiSecret?.startsWith('****')) delete cleanData.airteltigoCashApiSecret;
  if (cleanData.customGatewayApiSecret?.startsWith('****')) delete cleanData.customGatewayApiSecret;

  const gateway = await prisma.paymentGateway.upsert({
    where: { eventId },
    update: cleanData,
    create: { eventId, ...cleanData },
  });

  // Mask sensitive keys in response
  if (gateway.stripeSecretKey) gateway.stripeSecretKey = '****' + gateway.stripeSecretKey.slice(-4);
  if (gateway.stripeWebhookSecret) gateway.stripeWebhookSecret = '****';
  if (gateway.paystackSecretKey) gateway.paystackSecretKey = '****' + gateway.paystackSecretKey.slice(-4);
  if (gateway.flutterwaveSecretKey) gateway.flutterwaveSecretKey = '****' + gateway.flutterwaveSecretKey.slice(-4);
  if (gateway.mtnMomoApiSecret) gateway.mtnMomoApiSecret = '****' + gateway.mtnMomoApiSecret.slice(-4);
  if (gateway.telecelCashApiSecret) gateway.telecelCashApiSecret = '****' + gateway.telecelCashApiSecret.slice(-4);
  if (gateway.airteltigoCashApiSecret) gateway.airteltigoCashApiSecret = '****' + gateway.airteltigoCashApiSecret.slice(-4);
  if (gateway.customGatewayApiSecret) gateway.customGatewayApiSecret = '****' + gateway.customGatewayApiSecret.slice(-4);

  res.json({ gateway });
}));

// ============================================
// PUBLIC ENDPOINTS FOR RSVP/TICKETING FORM
// ============================================

/**
 * GET /api/ticketing/public/:eventSlug/form
 * Get public form configuration (fields + tickets) for an event
 */
router.get('/public/:eventSlug/form', asyncHandler(async (req, res) => {
  const { eventSlug } = req.params;

  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    select: {
      id: true,
      name: true,
      rsvpMode: true,
      requireApproval: true,
      formFields: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      ticketTypes: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      paymentGateway: {
        select: {
          gateway: true,
          currency: true,
          stripePublicKey: true,
          paystackPublicKey: true,
          flutterwavePublicKey: true,
        },
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Parse options from JSON string
  const fields = event.formFields.map((f: any) => ({
    ...f,
    options: f.options ? JSON.parse(f.options) : null,
  }));

  // Filter available tickets (check dates and quantity)
  const now = new Date();
  const tickets = event.ticketTypes.filter((t: any) => {
    if (t.saleStartDate && new Date(t.saleStartDate) > now) return false;
    if (t.saleEndDate && new Date(t.saleEndDate) < now) return false;
    if (t.quantityTotal > 0 && t.quantitySold >= t.quantityTotal) return false;
    return true;
  }).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: t.price,
    currency: t.currency,
    available: t.quantityTotal === 0 ? 999 : t.quantityTotal - t.quantitySold,
    maxPerOrder: t.maxPerOrder,
  }));

  res.json({
    eventId: event.id,
    eventName: event.name,
    rsvpMode: event.rsvpMode,
    requireApproval: event.requireApproval,
    fields,
    tickets: event.rsvpMode === 'rsvp' ? [] : tickets,
    payment: event.rsvpMode !== 'rsvp' && event.paymentGateway ? {
      gateway: event.paymentGateway.gateway,
      currency: event.paymentGateway.currency,
      publicKey: event.paymentGateway.gateway === 'stripe' 
        ? event.paymentGateway.stripePublicKey
        : event.paymentGateway.gateway === 'paystack'
        ? event.paymentGateway.paystackPublicKey
        : event.paymentGateway.flutterwavePublicKey,
    } : null,
  });
}));

export default router;

