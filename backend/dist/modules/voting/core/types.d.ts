export type VotingMode = 'AWARDS' | 'ELECTION';
export type FreeVoteScope = 'EVENT' | 'CONTEST';
export type VotingChannel = 'WEB' | 'USSD';
export type VotingConfigInput = {
    mode?: VotingMode;
    isEnabled?: boolean;
    isPublished?: boolean;
    allowFreeVotes?: boolean;
    allowPaidVotes?: boolean;
    allowPublicNominations?: boolean;
    requireOtpForElection?: boolean;
    freeVoteScope?: FreeVoteScope;
    voteUnitPrice?: number;
    currency?: string;
    maxVotesPerPurchase?: number;
    freeVoteLabel?: string | null;
    paidVoteLabel?: string | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
    settingsJson?: Record<string, unknown> | null;
};
export type CastVoteInput = {
    eventId: string;
    contestId: string;
    optionId: string;
    voterKey: string;
    channel: VotingChannel;
};
export type CastFreeAwardVoteInput = CastVoteInput & {
    scope: FreeVoteScope;
};
export type CreatePaidVoteIntentInput = {
    eventId: string;
    contestId: string;
    optionId: string;
    quantity: number;
    buyerIdentity: {
        voterKey: string;
    };
    channel: VotingChannel;
    paymentGatewayId: string;
};
export type VotingResultRow = {
    optionId: string;
    optionName: string;
    totalVotes: number;
    freeVotes: number;
    paidVotes: number;
    electionVotes: number;
};
//# sourceMappingURL=types.d.ts.map