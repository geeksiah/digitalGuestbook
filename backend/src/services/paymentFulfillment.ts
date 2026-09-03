import type { PaymentIntent, Transaction } from '@prisma/client';
import { AppError } from '../middleware/errorHandler.js';
import prisma from '../utils/prisma.js';

type TicketSelection = {
  ticketTypeId: string;
  quantity: number;
};

type TicketPaymentMetadata = {
  primaryName: string;
  secondaryName?: string;
  email?: string;
  phone?: string;
  attendance?: 'YES' | 'NO' | 'MAYBE';
  guestCount?: number;
  mealPreference?: string;
  dietaryNotes?: string;
  note?: string;
  submissionChannel?: string;
  customFields?: Record<string, unknown>;
  tickets: TicketSelection[];
  promoCodeId?: string;
};

type GiftItem = {
  giftPackageId: string;
  quantity: number;
};

type GiftPaymentMetadata = {
  guestName: string;
  guestPhone?: string;
  guestEmail?: string;
  note?: string;
  deliveryDate?: string;
  cashGiftAmount?: number;
  packageItems?: GiftItem[];
  /** Settlement frozen at checkout by createPaymentIntent. */
  giftSettlement?: {
    packageAmount: number;
    cashGiftAmount: number;
    totalAmount: number;
    platformFeeAmount: number;
    processingFeeAmount: number;
    cashProcessingFee: number;
    ownerNetAmount: number;
  };
  payoutRouting?: 'ADMIN_MANUAL' | 'OWNER_AUTOMATED';
  ownerWalletId?: string;
  routedWalletType?: string;
};

type VotePaymentMetadata = {
  contestId: string;
  optionId: string;
  voteCount: number;
  voterKey: string;
  electionVoterKey?: string;
};

const parseMetadata = <T extends Record<string, unknown>>(intent: PaymentIntent): T => {
  try {
    return intent.metadataJson ? (JSON.parse(intent.metadataJson) as T) : ({} as T);
  } catch {
    return {} as T;
  }
};

export const releaseTicketInventoryHolds = async (
  paymentIntentId: string,
  reason: 'RELEASED' | 'EXPIRED' = 'RELEASED'
) => {
  const now = new Date();
  const status = reason === 'EXPIRED' ? 'EXPIRED' : 'RELEASED';
  await prisma.ticketInventoryHold.updateMany({
    where: {
      paymentIntentId,
      status: 'ACTIVE',
    },
    data: {
      status,
      releasedAt: now,
    },
  });
};

export const fulfillTicketPurchase = async (intent: PaymentIntent, tx: Transaction) => {
  const metadata = parseMetadata<TicketPaymentMetadata>(intent);
  if (!metadata.primaryName || !metadata.tickets?.length) {
    throw new AppError('Ticket payment intent metadata is invalid', 400);
  }

  const existing = await prisma.rSVP.findFirst({
    where: { paymentIntentId: intent.id },
    select: { id: true },
  });
  if (existing) return existing;

  await prisma.$transaction(async (db) => {
    const eventConfig = await db.event.findUnique({
      where: { id: intent.eventId },
      select: { requireApproval: true },
    });

    const holds = await db.ticketInventoryHold.findMany({
      where: {
        paymentIntentId: intent.id,
        status: 'ACTIVE',
      },
      include: {
        ticketType: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });

    if (!holds.length) {
      throw new AppError('No active ticket inventory hold found for payment intent', 400);
    }

    const totalQuantity = holds.reduce((sum, hold) => sum + hold.quantity, 0);
    const primaryTicketName = holds[0]?.ticketType?.name || 'Ticket';
    const defaultCurrency = holds[0]?.ticketType?.currency || intent.currency || 'USD';

    await db.rSVP.create({
      data: {
        eventId: intent.eventId,
        paymentIntentId: intent.id,
        primaryName: metadata.primaryName,
        secondaryName: metadata.secondaryName || null,
        email: metadata.email || null,
        phone: metadata.phone || null,
        attendance: metadata.attendance || 'YES',
        guestCount: Math.max(1, Number(metadata.guestCount || totalQuantity || 1)),
        mealPreference: metadata.mealPreference || null,
        dietaryNotes: metadata.dietaryNotes || null,
        note: metadata.note || null,
        submissionChannel: metadata.submissionChannel || 'web',
        status: eventConfig?.requireApproval ? 'PENDING' : 'APPROVED',
        ticketType: primaryTicketName,
        ticketQuantity: totalQuantity,
        amountPaid: tx.grossAmount,
        currency: defaultCurrency,
        paymentStatus: 'PAID',
        paymentMethod: intent.gateway,
        paymentRef: tx.providerTransactionId,
        paymentDate: new Date(),
        customFields:
          metadata.customFields && Object.keys(metadata.customFields).length > 0
            ? JSON.stringify(metadata.customFields)
            : null,
      },
    });

    for (const hold of holds) {
      await db.ticketType.update({
        where: { id: hold.ticketTypeId },
        data: {
          quantitySold: { increment: hold.quantity },
        },
      });
    }

    if (metadata.promoCodeId) {
      await db.promoCode.update({
        where: { id: metadata.promoCodeId },
        data: { usageCount: { increment: 1 } },
      }).catch(() => undefined);
    }

    await db.ticketInventoryHold.updateMany({
      where: {
        paymentIntentId: intent.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'CONSUMED',
        consumedAt: new Date(),
      },
    });
  });
};

export const fulfillGiftPurchase = async (intent: PaymentIntent, tx: Transaction) => {
  const metadata = parseMetadata<GiftPaymentMetadata>(intent);
  if (!metadata.guestName) {
    throw new AppError('Gift payment intent metadata is invalid', 400);
  }

  const existing = await prisma.giftOrder.findFirst({
    where: { paymentIntentId: intent.id },
    select: { id: true },
  });
  if (existing) return existing;

  const packageItems = (metadata.packageItems || []).filter(
    (item) => item.giftPackageId && Number(item.quantity || 0) > 0
  );
  const cashGiftAmount = Math.max(0, Number(metadata.cashGiftAmount || 0));

  await prisma.$transaction(async (db) => {
    const packages = packageItems.length
      ? await db.giftPackage.findMany({
          where: {
            id: { in: packageItems.map((item) => item.giftPackageId) },
            isActive: true,
          },
        })
      : [];

    const lines: Array<{
      giftPackageId: string | null;
      type: 'PACKAGE' | 'CASH';
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }> = [];

    let packageTotal = 0;
    for (const item of packageItems) {
      const pkg = packages.find((entry) => entry.id === item.giftPackageId);
      if (!pkg) throw new AppError('Gift package not found during fulfillment', 404);
      const lineTotal = pkg.price * item.quantity;
      packageTotal += lineTotal;
      lines.push({
        giftPackageId: pkg.id,
        type: 'PACKAGE',
        quantity: item.quantity,
        unitPrice: pkg.price,
        lineTotal,
      });
    }

    if (cashGiftAmount > 0) {
      lines.push({
        giftPackageId: null,
        type: 'CASH',
        quantity: 1,
        unitPrice: cashGiftAmount,
        lineTotal: cashGiftAmount,
      });
    }

    // The settlement was frozen at checkout. Falling back to the raw amounts
    // keeps older intents (written before this field existed) fulfillable.
    const settlement = metadata.giftSettlement || {
      packageAmount: packageTotal,
      cashGiftAmount,
      totalAmount: packageTotal + cashGiftAmount,
      platformFeeAmount: 0,
      processingFeeAmount: 0,
      cashProcessingFee: 0,
      ownerNetAmount: cashGiftAmount,
    };
    const payoutRouting = metadata.payoutRouting === 'OWNER_AUTOMATED' ? 'OWNER_AUTOMATED' : 'ADMIN_MANUAL';

    const order = await db.giftOrder.create({
      data: {
        eventId: intent.eventId,
        paymentIntentId: intent.id,
        guestName: metadata.guestName,
        guestPhone: metadata.guestPhone || null,
        guestEmail: metadata.guestEmail || null,
        deliveryDate: metadata.deliveryDate ? new Date(metadata.deliveryDate) : null,
        note: metadata.note || null,
        paymentMethod: intent.gateway,
        paymentReference: tx.providerTransactionId,
        currency: intent.currency,
        totalAmount: tx.grossAmount,
        cashGiftAmount: cashGiftAmount > 0 ? cashGiftAmount : null,
        packageAmount: settlement.packageAmount,
        platformFeeAmount: settlement.platformFeeAmount,
        processingFeeAmount: settlement.processingFeeAmount,
        ownerNetAmount: settlement.ownerNetAmount,
        payoutRouting,
        status: 'PAID',
      },
    });

    if (lines.length) {
      await db.giftOrderItem.createMany({
        data: lines.map((line) => ({
          orderId: order.id,
          giftPackageId: line.giftPackageId,
          type: line.type,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
        })),
      });
    }

    // Payout balances are built from TransactionLegacy. Gift items settle
    // wholly to the platform (netAmount 0); the cash gift carries the owner
    // net. Rows already split at the gateway are recorded as OWNER_AUTOMATED
    // so the owner cannot also request a payout for money already sent.
    if (settlement.packageAmount > 0) {
      await db.transactionLegacy.create({
        data: {
          eventId: intent.eventId,
          type: 'gift_package_sale',
          grossAmount: settlement.packageAmount,
          platformFee: settlement.packageAmount,
          processingFee: Math.max(0, settlement.processingFeeAmount - settlement.cashProcessingFee),
          netAmount: 0,
          currency: intent.currency,
          paymentMethod: intent.gateway,
          paymentRef: tx.providerTransactionId,
          payoutRouting: 'ADMIN_MANUAL',
          buyerName: metadata.guestName,
          buyerEmail: metadata.guestEmail || null,
          status: 'completed',
        },
      });
    }

    if (cashGiftAmount > 0) {
      await db.transactionLegacy.create({
        data: {
          eventId: intent.eventId,
          type: 'gift_cash',
          grossAmount: cashGiftAmount,
          platformFee: Math.max(0, cashGiftAmount - settlement.ownerNetAmount - settlement.cashProcessingFee),
          processingFee: settlement.cashProcessingFee,
          netAmount: settlement.ownerNetAmount,
          currency: intent.currency,
          paymentMethod: intent.gateway,
          paymentRef: tx.providerTransactionId,
          payoutRouting,
          routedWalletType: metadata.routedWalletType || null,
          ownerWalletId: metadata.ownerWalletId || null,
          buyerName: metadata.guestName,
          buyerEmail: metadata.guestEmail || null,
          status: 'completed',
        },
      });
    }

    await db.auditLog.create({
      data: {
        eventId: intent.eventId,
        action: 'GIFT_ORDER_PAID_WEBHOOK',
        entityType: 'GIFT_ORDER',
        entityId: order.id,
        details: JSON.stringify({
          paymentIntentId: intent.id,
          providerTransactionId: tx.providerTransactionId,
          packageTotal,
          cashGiftAmount,
          totalAmount: tx.grossAmount,
          settlement,
          payoutRouting,
        }),
      },
    });
  });
};

export const fulfillVotePurchase = async (intent: PaymentIntent, tx: Transaction) => {
  const metadata = parseMetadata<VotePaymentMetadata>(intent);
  if (!metadata.contestId || !metadata.optionId || !metadata.voterKey) {
    throw new AppError('Vote payment intent metadata is invalid', 400);
  }
  const voteCount = Math.max(1, Number(metadata.voteCount || 1));

  const existingGrant = await prisma.voteGrant.findFirst({
    where: { paymentIntentId: intent.id },
    select: { id: true },
  });
  if (existingGrant) return existingGrant;

  await prisma.$transaction(async (db) => {
    const option = await db.votingOption.findFirst({
      where: {
        id: metadata.optionId,
        contestId: metadata.contestId,
        eventId: intent.eventId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!option) throw new AppError('Voting option not found', 404);

    const grant = await db.voteGrant.create({
      data: {
        eventId: intent.eventId,
        contestId: metadata.contestId,
        voterKey: metadata.voterKey,
        electionVoterKey: metadata.electionVoterKey || null,
        voteType: 'PAID',
        voteCount,
        paymentIntentId: intent.id,
        metadataJson: JSON.stringify({
          providerTransactionId: tx.providerTransactionId,
        }),
      },
    });

    await db.voteRecord.create({
      data: {
        eventId: intent.eventId,
        contestId: metadata.contestId,
        optionId: metadata.optionId,
        voteGrantId: grant.id,
        paymentIntentId: intent.id,
        voterKey: metadata.voterKey,
        voteType: 'PAID',
        voteCount,
      },
    });

    await db.votingOption.update({
      where: { id: metadata.optionId },
      data: {
        paidVotes: { increment: voteCount },
        totalVotes: { increment: voteCount },
      },
    });
  });
};
