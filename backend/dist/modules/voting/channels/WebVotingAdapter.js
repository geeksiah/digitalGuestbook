"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebVotingAdapter = void 0;
class WebVotingAdapter {
    votingService;
    constructor(votingService) {
        this.votingService = votingService;
    }
    async handleRequest(input) {
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
exports.WebVotingAdapter = WebVotingAdapter;
//# sourceMappingURL=WebVotingAdapter.js.map