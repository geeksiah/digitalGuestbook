import type { PaymentIntent, Prisma, PrismaClient, VoteGrant, VoteRecord, VotingContest, VotingEventConfig, VotingOption } from '@prisma/client';
import { AppError } from '../../../middleware/errorHandler.js';
import prismaClient from '../../../utils/prisma.js';
import type { IVotingRepository, VotingEventLite } from './IVotingRepository.js';
import type { VotingConfigInput, VotingResultRow } from './types.js';

type DbLike = PrismaClient | Prisma.TransactionClient;

const toSettingsString = (settings: Record<string, unknown> | null | undefined) =>
  settings ? JSON.stringify(settings) : null;

const toConfigData = (input: VotingConfigInput): Prisma.VotingEventConfigUncheckedUpdateInput => ({
  mode: input.mode ?? undefined,
  isEnabled: input.isEnabled ?? undefined,
  isPublished: input.isPublished ?? undefined,
  allowFreeVotes: input.allowFreeVotes ?? undefined,
  allowPaidVotes: input.allowPaidVotes ?? undefined,
  allowPublicNominations: input.allowPublicNominations ?? undefined,
  requireOtpForElection: input.requireOtpForElection ?? undefined,
  freeVoteScope: input.freeVoteScope ?? undefined,
  voteUnitPrice: input.voteUnitPrice ?? undefined,
  currency: input.currency ?? undefined,
  maxVotesPerPurchase: input.maxVotesPerPurchase ?? undefined,
  freeVoteLabel: input.freeVoteLabel === undefined ? undefined : input.freeVoteLabel,
  paidVoteLabel: input.paidVoteLabel === undefined ? undefined : input.paidVoteLabel,
  startsAt: input.startsAt === undefined ? undefined : input.startsAt,
  endsAt: input.endsAt === undefined ? undefined : input.endsAt,
  settingsJson: input.settingsJson === undefined ? undefined : toSettingsString(input.settingsJson),
});

export class PrismaVotingRepository implements IVotingRepository {
  private readonly db: DbLike;

  constructor(db: DbLike = prismaClient) {
    this.db = db;
  }

  async withTransaction<T>(fn: (repo: IVotingRepository) => Promise<T>): Promise<T> {
    if ('$transaction' in this.db && typeof this.db.$transaction === 'function') {
      return this.db.$transaction((tx) => fn(new PrismaVotingRepository(tx)));
    }
    return fn(this);
  }

  async getEventById(eventId: string): Promise<VotingEventLite | null> {
    return this.db.event.findUnique({
      where: { id: eventId },
      select: { id: true, slug: true, name: true, ownerId: true, defaultCurrency: true },
    });
  }

  async getEventBySlug(slug: string): Promise<VotingEventLite | null> {
    return this.db.event.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, ownerId: true, defaultCurrency: true },
    });
  }

  async getVotingConfig(eventId: string): Promise<VotingEventConfig | null> {
    return this.db.votingEventConfig.findUnique({ where: { eventId } });
  }

  async upsertVotingConfig(eventId: string, input: VotingConfigInput): Promise<VotingEventConfig> {
    return this.db.votingEventConfig.upsert({
      where: { eventId },
      update: toConfigData(input),
      create: {
        eventId,
        mode: input.mode ?? 'AWARDS',
        isEnabled: input.isEnabled ?? true,
        isPublished: input.isPublished ?? false,
        allowFreeVotes: input.allowFreeVotes ?? true,
        allowPaidVotes: input.allowPaidVotes ?? false,
        allowPublicNominations: input.allowPublicNominations ?? false,
        requireOtpForElection: input.requireOtpForElection ?? true,
        freeVoteScope: input.freeVoteScope ?? 'CONTEST',
        voteUnitPrice: input.voteUnitPrice ?? 1,
        currency: input.currency ?? 'USD',
        maxVotesPerPurchase: input.maxVotesPerPurchase ?? 100,
        freeVoteLabel: input.freeVoteLabel ?? null,
        paidVoteLabel: input.paidVoteLabel ?? null,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        settingsJson: toSettingsString(input.settingsJson),
      },
    });
  }

  async listContests(eventId: string, activeOnly = false): Promise<VotingContest[]> {
    return this.db.votingContest.findMany({
      where: { eventId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async listOptions(eventId: string, contestId: string, activeOnly = false): Promise<VotingOption[]> {
    return this.db.votingOption.findMany({
      where: { eventId, contestId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findContest(eventId: string, contestId: string): Promise<VotingContest | null> {
    return this.db.votingContest.findFirst({
      where: { id: contestId, eventId },
    });
  }

  async findOption(eventId: string, contestId: string, optionId: string): Promise<VotingOption | null> {
    return this.db.votingOption.findFirst({
      where: { id: optionId, eventId, contestId },
    });
  }

  async findVoteGrantByPaymentIntent(paymentIntentId: string): Promise<VoteGrant | null> {
    return this.db.voteGrant.findFirst({ where: { paymentIntentId } });
  }

  async createVoteGrant(data: {
    eventId: string;
    contestId: string;
    voterKey: string;
    voteType: 'FREE' | 'PAID' | 'ELECTION';
    voteCount: number;
    paymentIntentId?: string | null;
    metadataJson?: string | null;
  }): Promise<VoteGrant> {
    return this.db.voteGrant.create({
      data: {
        eventId: data.eventId,
        contestId: data.contestId,
        voterKey: data.voterKey,
        voteType: data.voteType,
        voteCount: data.voteCount,
        paymentIntentId: data.paymentIntentId ?? null,
        metadataJson: data.metadataJson ?? null,
      },
    });
  }

  async createVoteRecord(data: {
    eventId: string;
    contestId: string;
    optionId: string;
    voterKey: string;
    voteType: 'FREE' | 'PAID' | 'ELECTION';
    voteCount: number;
    channel: 'WEB' | 'USSD';
    voteGrantId?: string | null;
    paymentIntentId?: string | null;
  }): Promise<VoteRecord> {
    return this.db.voteRecord.create({
      data: {
        eventId: data.eventId,
        contestId: data.contestId,
        optionId: data.optionId,
        voterKey: data.voterKey,
        voteType: data.voteType,
        voteCount: data.voteCount,
        channel: data.channel,
        voteGrantId: data.voteGrantId ?? null,
        paymentIntentId: data.paymentIntentId ?? null,
      },
    });
  }

  async incrementOptionVotes(optionId: string, deltas: { total: number; free?: number; paid?: number }): Promise<void> {
    await this.db.votingOption.update({
      where: { id: optionId },
      data: {
        totalVotes: { increment: deltas.total },
        freeVotes: { increment: deltas.free ?? 0 },
        paidVotes: { increment: deltas.paid ?? 0 },
      },
    });
  }

  async createFreeVoteUsage(data: {
    eventId: string;
    contestId?: string | null;
    optionId?: string | null;
    voterKey: string;
    voteRecordId?: string | null;
  }): Promise<void> {
    await this.db.freeVoteUsage.create({
      data: {
        eventId: data.eventId,
        contestId: data.contestId ?? null,
        optionId: data.optionId ?? null,
        voterKey: data.voterKey,
        voteRecordId: data.voteRecordId ?? null,
      },
    });
  }

  async findPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null> {
    return this.db.paymentIntent.findUnique({ where: { id: paymentIntentId } });
  }

  async getResults(eventId: string, contestId: string): Promise<VotingResultRow[]> {
    const options = await this.db.votingOption.findMany({
      where: { eventId, contestId, isActive: true },
      orderBy: [{ totalVotes: 'desc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        totalVotes: true,
        freeVotes: true,
        paidVotes: true,
      },
    });

    const electionVotes = await this.db.voteRecord.groupBy({
      by: ['optionId'],
      where: { eventId, contestId, voteType: 'ELECTION' },
      _sum: { voteCount: true },
    });

    const electionMap = new Map<string, number>(
      electionVotes.map((row) => [row.optionId, Number(row._sum.voteCount || 0)])
    );

    return options.map((option) => ({
      optionId: option.id,
      optionName: option.name,
      totalVotes: option.totalVotes,
      freeVotes: option.freeVotes,
      paidVotes: option.paidVotes,
      electionVotes: electionMap.get(option.id) || 0,
    }));
  }
}

export const mapPrismaUniquenessError = (error: unknown, fallbackMessage: string) => {
  const maybeError = error as { code?: string };
  if (maybeError?.code === 'P2002') {
    throw new AppError(fallbackMessage, 409);
  }
  throw error;
};

