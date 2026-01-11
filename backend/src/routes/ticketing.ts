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
// Note: Payment gateway configuration is now system-wide.
// See /api/payment-gateways for gateway management.
// See /api/payment-gateways/events/:eventId for event-specific gateway selection.

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
      eventPaymentGateways: {
        where: { isActive: true },
        include: {
          paymentGateway: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              gateway: true,
              currency: true,
              stripePublicKey: true,
              paystackPublicKey: true,
              flutterwavePublicKey: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
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
    paymentGateways: event.rsvpMode !== 'rsvp' && event.eventPaymentGateways?.length > 0
      ? event.eventPaymentGateways.map((eg: any) => {
          const g = eg.paymentGateway;
          return {
            id: g.id,
            name: g.name,
            gateway: g.gateway,
            currency: g.currency,
            publicKey:
              g.gateway === 'stripe'
                ? g.stripePublicKey
                : g.gateway === 'paystack'
                ? g.paystackPublicKey
                : g.gateway === 'flutterwave'
                ? g.flutterwavePublicKey
                : null,
            sortOrder: eg.sortOrder,
          };
        })
      : [],
  });
}));

/**
 * POST /api/ticketing/public/:eventSlug/checkout
 * Process ticket purchase (create RSVP with payment)
 */
const checkoutSchema = z.object({
  // Personal info
  primaryName: z.string().min(1),
  secondaryName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  
  // Ticket selection
  tickets: z.array(z.object({
    ticketTypeId: z.string().uuid(),
    quantity: z.number().min(1),
  })).min(1),
  
  // Promo code (optional)
  promoCode: z.string().optional(),
  
  // Payment
  paymentGatewayId: z.string().uuid(),
  paymentMethod: z.string(), // stripe | paystack | flutterwave | etc
  paymentReference: z.string(), // External payment reference from gateway
  
  // Custom form fields
  customFields: z.record(z.any()).optional(),
  
  // Other RSVP fields
  attendance: z.enum(['YES', 'NO', 'MAYBE']).default('YES'),
  guestCount: z.number().default(0),
  mealPreference: z.string().optional(),
  dietaryNotes: z.string().optional(),
  note: z.string().optional(),
  submissionChannel: z.string().optional(),
});

router.post('/public/:eventSlug/checkout', asyncHandler(async (req, res) => {
  const { eventSlug } = req.params;
  const data = checkoutSchema.parse(req.body);

  // Find event
  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    include: {
      ticketTypes: true,
      eventPaymentGateways: {
        where: { paymentGatewayId: data.paymentGatewayId, isActive: true },
        include: { paymentGateway: true },
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.rsvpMode !== 'paid') {
    throw new AppError('This event does not accept paid tickets', 400);
  }

  // Verify ticket availability and calculate total
  let totalAmount = 0;
  const ticketUpdates: Array<{ id: string; quantity: number }> = [];

  for (const selection of data.tickets) {
    const ticketType = event.ticketTypes.find((t: any) => t.id === selection.ticketTypeId);
    if (!ticketType) {
      throw new AppError(`Ticket type ${selection.ticketTypeId} not found`, 404);
    }
    if (!ticketType.isActive) {
      throw new AppError(`Ticket type ${ticketType.name} is not available`, 400);
    }
    if (selection.quantity > ticketType.maxPerOrder) {
      throw new AppError(`Maximum ${ticketType.maxPerOrder} tickets allowed for ${ticketType.name}`, 400);
    }
    const available = ticketType.quantityTotal === 0 
      ? 999 
      : ticketType.quantityTotal - ticketType.quantitySold;
    if (selection.quantity > available) {
      throw new AppError(`Only ${available} tickets available for ${ticketType.name}`, 400);
    }

    totalAmount += ticketType.price * selection.quantity;
    ticketUpdates.push({ id: ticketType.id, quantity: selection.quantity });
  }

  // Apply promo code if provided
  let discountAmount = 0;
  let promoCodeRecord = null;
  if (data.promoCode) {
    promoCodeRecord = await prisma.promoCode.findFirst({
      where: {
        eventId: event.id,
        code: data.promoCode.toUpperCase(),
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });

    if (promoCodeRecord) {
      // Check usage limits
      const usageCount = await prisma.rSVP.count({
        where: {
          eventId: event.id,
          promoCodeId: promoCodeRecord.id,
        },
      });

      if (promoCodeRecord.maxUses && usageCount >= promoCodeRecord.maxUses) {
        throw new AppError('Promo code has reached maximum usage limit', 400);
      }

      // Calculate discount
      if (promoCodeRecord.discountType === 'PERCENTAGE') {
        discountAmount = (totalAmount * promoCodeRecord.discountValue) / 100;
      } else {
        discountAmount = promoCodeRecord.discountValue;
      }

      if (discountAmount > totalAmount) {
        discountAmount = totalAmount;
      }
    } else {
      throw new AppError('Invalid or expired promo code', 400);
    }
  }

  const finalAmount = totalAmount - discountAmount;

  // Calculate fees
  const platformFee = (finalAmount * (event.platformFeePercent || 0)) / 100;
  const processingFeePercent = event.processingFeePercent || 0;
  const processingFeeFixed = event.processingFeeFixed || 0;
  const processingFee = (finalAmount * processingFeePercent) / 100 + processingFeeFixed;
  const amountPaid = finalAmount + platformFee + processingFee;

  // Verify payment gateway
  const eventGateway = event.eventPaymentGateways[0];
  if (!eventGateway) {
    throw new AppError('Payment gateway not configured for this event', 400);
  }

  // Create RSVP with ticket purchase
  const rsvp = await prisma.rSVP.create({
    data: {
      eventId: event.id,
      primaryName: data.primaryName,
      secondaryName: data.secondaryName,
      email: data.email || null,
      phone: data.phone,
      attendance: data.attendance,
      guestCount: data.guestCount,
      mealPreference: data.mealPreference,
      dietaryNotes: data.dietaryNotes,
      note: data.note,
      submissionChannel: data.submissionChannel || 'web',
      status: event.requireApproval ? 'PENDING' : 'APPROVED',
      
      // Ticket purchase fields
      ticketTypeId: data.tickets[0].ticketTypeId, // Primary ticket type
      ticketQuantity: data.tickets.reduce((sum, t) => sum + t.quantity, 0),
      amountPaid: amountPaid,
      paymentStatus: 'PAID', // Assume paid if payment reference provided
      paymentMethod: data.paymentMethod,
      paymentReference: data.paymentReference,
      promoCodeId: promoCodeRecord?.id,
    },
  });

  // Update ticket quantities
  await Promise.all(
    ticketUpdates.map((update) =>
      prisma.ticketType.update({
        where: { id: update.id },
        data: {
          quantitySold: { increment: update.quantity },
        },
      })
    )
  );

  // Update promo code usage
  if (promoCodeRecord) {
    await prisma.promoCode.update({
      where: { id: promoCodeRecord.id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  // Create transaction record
  await prisma.transaction.create({
    data: {
      eventId: event.id,
      rsvpId: rsvp.id,
      type: 'ticket_sale',
      grossAmount: finalAmount,
      platformFee: platformFee,
      processingFee: processingFee,
      netAmount: finalAmount - platformFee,
      currency: event.ticketTypes[0]?.currency || 'USD',
      paymentMethod: data.paymentMethod,
      paymentRef: data.paymentReference,
      ticketTypeName: event.ticketTypes[0]?.name,
      ticketQuantity: data.tickets.reduce((sum, t) => sum + t.quantity, 0),
      buyerName: data.primaryName,
      buyerEmail: data.email,
      status: 'completed',
    },
  });

  res.status(201).json({
    success: true,
    rsvp: {
      id: rsvp.id,
      status: rsvp.status,
    },
    message: 'Ticket purchase successful!',
  });
}));

export default router;
