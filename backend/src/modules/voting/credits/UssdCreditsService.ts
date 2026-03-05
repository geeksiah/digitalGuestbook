import { AppError } from '../../../middleware/errorHandler.js';
import prisma from '../../../utils/prisma.js';

export class UssdCreditsService {
  async getWallet(input: { ownerId?: string | null; eventId?: string | null }) {
    return prisma.ussdCreditWallet.findFirst({
      where: {
        ownerId: input.ownerId ?? undefined,
        eventId: input.eventId ?? undefined,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ensureWalletForEvent(eventId: string) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, ownerId: true, defaultCurrency: true },
    });
    if (!event) throw new AppError('Event not found', 404);

    const existing = await prisma.ussdCreditWallet.findFirst({
      where: { eventId: event.id },
    });
    if (existing) return existing;

    return prisma.ussdCreditWallet.create({
      data: {
        ownerId: event.ownerId ?? null,
        eventId: event.id,
        currency: event.defaultCurrency || 'USD',
      },
    });
  }

  async consumeCredits(walletId: string, units: number, reference: string, metadata?: Record<string, unknown>) {
    if (!Number.isFinite(units) || units <= 0) throw new AppError('Units must be greater than zero', 400);
    if (!reference.trim()) throw new AppError('Reference is required', 400);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.ussdCreditLedgerEntry.findFirst({
        where: {
          walletId,
          type: 'CONSUME',
          reference,
        },
      });
      if (existing) {
        const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: walletId } });
        return {
          status: 'ok' as const,
          idempotent: true,
          wallet,
        };
      }

      const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: walletId } });
      if (!wallet) throw new AppError('USSD wallet not found', 404);
      if (wallet.balanceUnits < units) {
        return {
          status: 'insufficient' as const,
          idempotent: false,
          wallet,
        };
      }

      await tx.ussdCreditLedgerEntry.create({
        data: {
          walletId,
          type: 'CONSUME',
          amountUnits: -Math.abs(units),
          reference,
          metadataJson: metadata ? JSON.stringify(metadata) : null,
        },
      });

      const updated = await tx.ussdCreditWallet.update({
        where: { id: walletId },
        data: {
          balanceUnits: { decrement: units },
        },
      });

      return {
        status: 'ok' as const,
        idempotent: false,
        wallet: updated,
      };
    });
  }

  async topupCredits(input: {
    walletId: string;
    units: number;
    paymentIntentId?: string | null;
    reference: string;
    metadata?: Record<string, unknown>;
  }) {
    if (!Number.isFinite(input.units) || input.units <= 0) {
      throw new AppError('Units must be greater than zero', 400);
    }
    if (!input.reference.trim()) throw new AppError('Reference is required', 400);

    return prisma.$transaction(async (tx) => {
      const existing = await tx.ussdCreditLedgerEntry.findFirst({
        where: {
          walletId: input.walletId,
          type: 'TOPUP',
          reference: input.reference,
        },
      });
      if (existing) {
        const wallet = await tx.ussdCreditWallet.findUnique({ where: { id: input.walletId } });
        return {
          idempotent: true,
          wallet,
        };
      }

      await tx.ussdCreditLedgerEntry.create({
        data: {
          walletId: input.walletId,
          type: 'TOPUP',
          amountUnits: Math.abs(input.units),
          reference: input.reference,
          paymentIntentId: input.paymentIntentId ?? null,
          metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
        },
      });

      const wallet = await tx.ussdCreditWallet.update({
        where: { id: input.walletId },
        data: {
          balanceUnits: { increment: Math.abs(input.units) },
        },
      });

      return {
        idempotent: false,
        wallet,
      };
    });
  }
}

