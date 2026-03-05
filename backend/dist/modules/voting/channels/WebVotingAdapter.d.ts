import type { IVotingChannelAdapter } from './IVotingChannelAdapter.js';
import type { VotingService } from '../core/VotingService.js';
import type { FreeVoteScope } from '../core/types.js';
type FreeVoteRequest = {
    eventId: string;
    contestId: string;
    optionId: string;
    voterKey: string;
    scope: FreeVoteScope;
};
type ElectionVoteRequest = {
    eventId: string;
    contestId: string;
    optionId: string;
    voterKey: string;
};
export declare class WebVotingAdapter implements IVotingChannelAdapter<FreeVoteRequest | ElectionVoteRequest, unknown> {
    private readonly votingService;
    constructor(votingService: VotingService);
    handleRequest(input: FreeVoteRequest | ElectionVoteRequest): Promise<unknown>;
}
export {};
//# sourceMappingURL=WebVotingAdapter.d.ts.map