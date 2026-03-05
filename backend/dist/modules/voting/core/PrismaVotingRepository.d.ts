import type { PaymentIntent, Prisma, PrismaClient, VoteGrant, VoteRecord, VotingContest, VotingEventConfig, VotingOption } from '@prisma/client';
import type { IVotingRepository, VotingEventLite } from './IVotingRepository.js';
import type { VotingConfigInput, VotingResultRow } from './types.js';
type DbLike = PrismaClient | Prisma.TransactionClient;
export declare class PrismaVotingRepository implements IVotingRepository {
    private readonly db;
    constructor(db?: DbLike);
    withTransaction<T>(fn: (repo: IVotingRepository) => Promise<T>): Promise<T>;
    getEventById(eventId: string): Promise<VotingEventLite | null>;
    getEventBySlug(slug: string): Promise<VotingEventLite | null>;
    getVotingConfig(eventId: string): Promise<VotingEventConfig | null>;
    upsertVotingConfig(eventId: string, input: VotingConfigInput): Promise<VotingEventConfig>;
    listContests(eventId: string, activeOnly?: boolean): Promise<VotingContest[]>;
    listOptions(eventId: string, contestId: string, activeOnly?: boolean): Promise<VotingOption[]>;
    findContest(eventId: string, contestId: string): Promise<VotingContest | null>;
    findOption(eventId: string, contestId: string, optionId: string): Promise<VotingOption | null>;
    findVoteGrantByPaymentIntent(paymentIntentId: string): Promise<VoteGrant | null>;
    createVoteGrant(data: {
        eventId: string;
        contestId: string;
        voterKey: string;
        voteType: 'FREE' | 'PAID' | 'ELECTION';
        voteCount: number;
        paymentIntentId?: string | null;
        metadataJson?: string | null;
    }): Promise<VoteGrant>;
    createVoteRecord(data: {
        eventId: string;
        contestId: string;
        optionId: string;
        voterKey: string;
        voteType: 'FREE' | 'PAID' | 'ELECTION';
        voteCount: number;
        channel: 'WEB' | 'USSD';
        voteGrantId?: string | null;
        paymentIntentId?: string | null;
    }): Promise<VoteRecord>;
    incrementOptionVotes(optionId: string, deltas: {
        total: number;
        free?: number;
        paid?: number;
    }): Promise<void>;
    createFreeVoteUsage(data: {
        eventId: string;
        contestId?: string | null;
        optionId?: string | null;
        voterKey: string;
        voteRecordId?: string | null;
    }): Promise<void>;
    findPaymentIntent(paymentIntentId: string): Promise<PaymentIntent | null>;
    getResults(eventId: string, contestId: string): Promise<VotingResultRow[]>;
}
export declare const mapPrismaUniquenessError: (error: unknown, fallbackMessage: string) => never;
export {};
//# sourceMappingURL=PrismaVotingRepository.d.ts.map