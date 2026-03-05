import type { IVotingRepository } from './IVotingRepository.js';
import type { CastFreeAwardVoteInput, CastVoteInput, CreatePaidVoteIntentInput, VotingConfigInput } from './types.js';
export declare class VotingService {
    private readonly repository;
    constructor(repository: IVotingRepository);
    configureVoting(eventId: string, config: VotingConfigInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string;
        eventId: string;
        mode: import(".prisma/client").$Enums.VoteMode;
        isEnabled: boolean;
        isPublished: boolean;
        allowFreeVotes: boolean;
        allowPaidVotes: boolean;
        allowPublicNominations: boolean;
        requireOtpForElection: boolean;
        freeVoteScope: import(".prisma/client").$Enums.FreeVoteScope;
        voteUnitPrice: number;
        maxVotesPerPurchase: number;
        freeVoteLabel: string | null;
        paidVoteLabel: string | null;
        startsAt: Date | null;
        endsAt: Date | null;
        settingsJson: string | null;
    }>;
    listContests(eventId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        eventId: string;
        title: string;
        sortOrder: number;
        mode: import(".prisma/client").$Enums.VoteMode;
        allowPublicNominations: boolean;
        startsAt: Date | null;
        endsAt: Date | null;
        nominationFormFieldsJson: string | null;
        metadataJson: string | null;
    }[]>;
    listOptions(eventId: string, contestId: string): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        isActive: boolean;
        eventId: string;
        sortOrder: number;
        metadataJson: string | null;
        totalVotes: number;
        contestId: string;
        imagePath: string | null;
        freeVotes: number;
        paidVotes: number;
    }[]>;
    castElectionVote(input: CastVoteInput): Promise<{
        id: string;
        createdAt: Date;
        eventId: string;
        paymentIntentId: string | null;
        channel: import(".prisma/client").$Enums.VoteChannel;
        contestId: string;
        voterKey: string;
        voteType: import(".prisma/client").$Enums.VoteType;
        voteCount: number;
        optionId: string;
        voteGrantId: string | null;
    } | undefined>;
    castFreeAwardVote(input: CastFreeAwardVoteInput): Promise<{
        id: string;
        createdAt: Date;
        eventId: string;
        paymentIntentId: string | null;
        channel: import(".prisma/client").$Enums.VoteChannel;
        contestId: string;
        voterKey: string;
        voteType: import(".prisma/client").$Enums.VoteType;
        voteCount: number;
        optionId: string;
        voteGrantId: string | null;
    } | undefined>;
    createPaidVoteIntent(input: CreatePaidVoteIntentInput): Promise<{
        intent: import(".prisma/client").PaymentIntent;
        nextAction: import("../../../services/paymentAdapters/types.js").PaymentNextAction;
    }>;
    applyPaidVoteGrant(input: {
        paymentIntentId: string;
    }): Promise<{
        voteGrant: {
            id: string;
            createdAt: Date;
            eventId: string;
            paymentIntentId: string | null;
            metadataJson: string | null;
            contestId: string;
            voterKey: string;
            electionVoterKey: string | null;
            voteType: import(".prisma/client").$Enums.VoteType;
            voteCount: number;
        };
        idempotent: boolean;
    }>;
    getResults(eventId: string, contestId: string): Promise<import("./types.js").VotingResultRow[]>;
}
//# sourceMappingURL=VotingService.d.ts.map