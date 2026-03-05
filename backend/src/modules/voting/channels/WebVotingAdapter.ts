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

export class WebVotingAdapter implements IVotingChannelAdapter<FreeVoteRequest | ElectionVoteRequest, unknown> {
  constructor(private readonly votingService: VotingService) {}

  async handleRequest(input: FreeVoteRequest | ElectionVoteRequest): Promise<unknown> {
    if ('scope' in input) {
      return this.votingService.castFreeAwardVote({
        ...input,
        channel: 'WEB',
      });
    }

    return this.votingService.castElectionVote({
      ...input,
      channel: 'WEB',
    });
  }
}

