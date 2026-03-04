import { Router } from 'express';
import { createHash } from 'crypto';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';
import { createPaymentIntent } from '../services/paymentCore.js';
import {
  filterEventGatewaysForOwner,
  resolveOwnerWalletState,
} from '../utils/walletPolicy.js';

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
  description: z.string().nullable().optional(),
  price: z.number().min(0),
  currency: z.string().default('USD'),
  quantityTotal: z.number().min(0).nullable().optional(),
  maxPerOrder: z.number().min(1).nullable().optional(),
  saleStartDate: z.string().datetime().nullable().optional(),
  saleEndDate: z.string().datetime().nullable().optional(),
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
      description: data.description ?? null,
      quantityTotal: data.quantityTotal ?? 0,
      maxPerOrder: data.maxPerOrder ?? 10,
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
      saleStartDate: data.saleStartDate === undefined
        ? undefined
        : data.saleStartDate
          ? new Date(data.saleStartDate)
          : null,
      saleEndDate: data.saleEndDate === undefined
        ? undefined
        : data.saleEndDate
          ? new Date(data.saleEndDate)
          : null,
      description: data.description === undefined ? undefined : data.description,
      quantityTotal: data.quantityTotal === undefined ? undefined : (data.quantityTotal ?? 0),
      maxPerOrder: data.maxPerOrder === undefined ? undefined : (data.maxPerOrder ?? 10),
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
    include: {
      Owner: {
        select: {
          countryCode: true,
          wallets: {
            where: { isActive: true },
            select: {
              id: true,
              walletType: true,
              isActive: true,
              isVerified: true,
              currency: true,
              paystackSubaccount: true,
              paystackRecipientCode: true,
            },
          },
        },
      },
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

  const walletState = resolveOwnerWalletState((event.Owner?.wallets || []) as any[]);
  const visibleGateways = filterEventGatewaysForOwner({
    eventGateways: event.eventPaymentGateways as any[],
    walletState,
  });
  const paystackWallet = walletState.walletByType.get('paystack');
  const isPaidMode = String(event.rsvpMode || '').toLowerCase() === 'paid';

  res.json({
    eventId: event.id,
    eventName: event.name,
    rsvpMode: event.rsvpMode,
    requireApproval: event.requireApproval,
    fields,
    tickets: isPaidMode ? tickets : [],
    walletMode: walletState.mode,
    paymentGateways: isPaidMode && visibleGateways?.length > 0
      ? visibleGateways.map((eg: any) => {
          const g = eg.paymentGateway;
          const splitConfig =
            g.gateway === 'paystack' && paystackWallet?.paystackSubaccount
              ? {
                  subaccount: paystackWallet.paystackSubaccount,
                  bearer: 'subaccount',
                  ownerWalletVerified: Boolean(paystackWallet.isVerified),
                }
              : null;

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
            splitConfig,
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
  paymentMethod: z.string().optional(), // legacy ignored in webhook-first flow
  
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
  const holdExpiryMinutes = Math.max(5, Number(process.env.TICKET_HOLD_EXPIRY_MINUTES || 30));
  const holdExpiresAt = new Date(Date.now() + holdExpiryMinutes * 60 * 1000);

  // Find event
  const event = await prisma.event.findUnique({
    where: { slug: eventSlug },
    include: {
      Owner: {
        include: {
          wallets: {
            where: { isActive: true },
            select: {
              id: true,
              walletType: true,
              isActive: true,
              isVerified: true,
              currency: true,
              paystackSubaccount: true,
              paystackRecipientCode: true,
            },
          },
        },
      },
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

  // Verify selected gateway is enabled and visible for owner wallet policy
  const ownerWalletState = resolveOwnerWalletState((event.Owner?.wallets || []) as any[]);
  const allowedGateways = filterEventGatewaysForOwner({
    eventGateways: event.eventPaymentGateways as any[],
    walletState: ownerWalletState,
  });
  const selectedGateway = allowedGateways.find((entry: any) => entry.paymentGatewayId === data.paymentGatewayId);
  if (!selectedGateway) {
    throw new AppError('Selected payment gateway is not enabled for this event', 400);
  }

  // Verify ticket availability and calculate base total
  let totalAmount = 0;
  const ticketSelections: Array<{ ticketTypeId: string; quantity: number }> = [];
  const now = new Date();
  const activeHolds = await prisma.ticketInventoryHold.findMany({
    where: {
      eventId: event.id,
      status: 'ACTIVE',
      expiresAt: { gt: now },
    },
    select: {
      ticketTypeId: true,
      quantity: true,
    },
  });
  const heldByTicket = new Map<string, number>();
  for (const hold of activeHolds) {
    heldByTicket.set(hold.ticketTypeId, (heldByTicket.get(hold.ticketTypeId) || 0) + hold.quantity);
  }

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
    const availableFromStock =
      ticketType.quantityTotal === 0
        ? 999999
        : ticketType.quantityTotal - ticketType.quantitySold;
    const heldQuantity = heldByTicket.get(ticketType.id) || 0;
    const available = Math.max(0, availableFromStock - heldQuantity);
    if (selection.quantity > available) {
      throw new AppError(`Only ${available} tickets available for ${ticketType.name}`, 400);
    }

    totalAmount += ticketType.price * selection.quantity;
    ticketSelections.push({ ticketTypeId: ticketType.id, quantity: selection.quantity });
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
      if (promoCodeRecord.usageLimit && promoCodeRecord.usageCount >= promoCodeRecord.usageLimit) {
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

  const baseAmount = Math.max(0, totalAmount - discountAmount);
  const ticketCurrency = event.ticketTypes[0]?.currency || event.defaultCurrency || 'USD';
  const idempotencySeed = JSON.stringify({
    eventId: event.id,
    gatewayId: data.paymentGatewayId,
    primaryName: data.primaryName.trim().toLowerCase(),
    phone: data.phone.trim(),
    tickets: ticketSelections.map((item) => ({ id: item.ticketTypeId, qty: item.quantity })),
    promoCode: promoCodeRecord?.id || null,
    total: Number(baseAmount.toFixed(2)),
  });
  const idempotencyKey =
    String(req.get('Idempotency-Key') || '').trim() ||
    createHash('sha256').update(idempotencySeed).digest('hex');

  const checkoutMetadata = {
    primaryName: data.primaryName.trim(),
    secondaryName: data.secondaryName?.trim() || undefined,
    email: data.email?.trim() || undefined,
    phone: data.phone.trim(),
    attendance: data.attendance,
    guestCount: data.guestCount,
    mealPreference: data.mealPreference?.trim() || undefined,
    dietaryNotes: data.dietaryNotes?.trim() || undefined,
    note: data.note?.trim() || undefined,
    submissionChannel: data.submissionChannel || 'web',
    customFields: data.customFields || {},
    tickets: ticketSelections,
    promoCodeId: promoCodeRecord?.id || undefined,
  };

  const { intent, nextAction } = await createPaymentIntent({
    eventId: event.id,
    purpose: 'TICKET',
    amount: baseAmount,
    currency: ticketCurrency,
    paymentGatewayId: data.paymentGatewayId,
    metadata: checkoutMetadata,
    idempotencyKey,
  });

  const existingHold = await prisma.ticketInventoryHold.findFirst({
    where: {
      paymentIntentId: intent.id,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    select: { expiresAt: true },
  });

  let effectiveHoldExpiresAt = holdExpiresAt;
  if (!existingHold) {
    await prisma.$transaction(async (tx) => {
      const refreshHolds = await tx.ticketInventoryHold.findMany({
        where: {
          eventId: event.id,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        select: {
          ticketTypeId: true,
          quantity: true,
        },
      });
      const holdMap = new Map<string, number>();
      for (const hold of refreshHolds) {
        holdMap.set(hold.ticketTypeId, (holdMap.get(hold.ticketTypeId) || 0) + hold.quantity);
      }

      for (const selection of ticketSelections) {
        const ticketType = event.ticketTypes.find((ticket) => ticket.id === selection.ticketTypeId);
        if (!ticketType) throw new AppError('Ticket type no longer exists', 404);
        const stockAvailable =
          ticketType.quantityTotal === 0
            ? 999999
            : ticketType.quantityTotal - ticketType.quantitySold;
        const holdQuantity = holdMap.get(ticketType.id) || 0;
        const available = Math.max(0, stockAvailable - holdQuantity);
        if (selection.quantity > available) {
          throw new AppError(`Only ${available} tickets available for ${ticketType.name}`, 400);
        }

        await tx.ticketInventoryHold.create({
          data: {
            eventId: event.id,
            ticketTypeId: selection.ticketTypeId,
            paymentIntentId: intent.id,
            quantity: selection.quantity,
            expiresAt: holdExpiresAt,
            status: 'ACTIVE',
          },
        });
      }
    });
  } else {
    effectiveHoldExpiresAt = existingHold.expiresAt;
  }

  res.status(201).json({
    success: true,
    paymentIntentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    holdExpiresAt: effectiveHoldExpiresAt.toISOString(),
    nextAction,
    message: 'Ticket checkout initialized. Complete payment to confirm.',
  });
}));

export default router;
