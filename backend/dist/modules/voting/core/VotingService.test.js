"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const VotingService_js_1 = require("./VotingService.js");
class InMemoryVotingRepo {
    duplicateFreeVote = false;
    async withTransaction(fn) {
        return fn(this);
    }
    async getEventById() {
        return { id: 'event-1', slug: 'event-1', name: 'Event', ownerId: 'owner-1', defaultCurrency: 'USD' };
    }
    async getEventBySlug() {
        return { id: 'event-1', slug: 'event-1', name: 'Event', ownerId: 'owner-1', defaultCurrency: 'USD' };
    }
    async getVotingConfig() {
        return {
            id: 'cfg',
            eventId: 'event-1',
            mode: 'AWARDS',
            isEnabled: true,
            isPublished: true,
            allowFreeVotes: true,
            allowPaidVotes: true,
            allowPublicNominations: true,
            requireOtpForElection: false,
            freeVoteScope: 'EVENT',
            voteUnitPrice: 1,
            currency: 'USD',
            maxVotesPerPurchase: 100,
            freeVoteLabel: null,
            paidVoteLabel: null,
            startsAt: null,
            endsAt: null,
            settingsJson: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    async upsertVotingConfig() {
        return (await this.getVotingConfig());
    }
    async listContests() {
        return [];
    }
    async listOptions() {
        return [];
    }
    async findContest() {
        return {
            id: 'contest-1',
            eventId: 'event-1',
            title: 'Contest',
            description: null,
            mode: 'AWARDS',
            isActive: true,
            allowPublicNominations: false,
            nominationFormFieldsJson: null,
            startsAt: null,
            endsAt: null,
            sortOrder: 0,
            metadataJson: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    async findOption() {
        return {
            id: 'option-1',
            eventId: 'event-1',
            contestId: 'contest-1',
            name: 'Option',
            description: null,
            imagePath: null,
            sortOrder: 0,
            isActive: true,
            totalVotes: 0,
            freeVotes: 0,
            paidVotes: 0,
            metadataJson: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
    }
    async findVoteGrantByPaymentIntent() {
        return null;
    }
    async createVoteGrant() {
        return {
            id: 'grant-1',
            eventId: 'event-1',
            contestId: 'contest-1',
            voterKey: 'voter-1',
            electionVoterKey: null,
            voteType: 'FREE',
            voteCount: 1,
            paymentIntentId: null,
            metadataJson: null,
            createdAt: new Date(),
        };
    }
    async createVoteRecord() {
        if (this.duplicateFreeVote) {
            const error = { code: 'P2002' };
            throw error;
        }
        return {
            id: 'record-1',
            eventId: 'event-1',
            contestId: 'contest-1',
            optionId: 'option-1',
            voteGrantId: null,
            paymentIntentId: null,
            voterKey: 'voter-1',
            voteType: 'FREE',
            channel: 'WEB',
            voteCount: 1,
            createdAt: new Date(),
        };
    }
    async incrementOptionVotes() { }
    async createFreeVoteUsage() { }
    async findPaymentIntent() {
        return null;
    }
    async getResults() {
        return [];
    }
}
(0, vitest_1.describe)('VotingService', () => {
    (0, vitest_1.it)('enforces free vote uniqueness conflicts', async () => {
        const repo = new InMemoryVotingRepo();
        repo.duplicateFreeVote = true;
        const service = new VotingService_js_1.VotingService(repo);
        await (0, vitest_1.expect)(service.castFreeAwardVote({
            eventId: 'event-1',
            contestId: 'contest-1',
            optionId: 'option-1',
            voterKey: 'voter-1',
            scope: 'CONTEST',
            channel: 'WEB',
        })).rejects.toMatchObject({
            statusCode: 409,
        });
    });
    (0, vitest_1.it)('returns idempotent paid grant result when grant exists', async () => {
        const repo = new InMemoryVotingRepo();
        const service = new VotingService_js_1.VotingService({
            ...repo,
            findVoteGrantByPaymentIntent: async () => ({
                id: 'grant-2',
                eventId: 'event-1',
                contestId: 'contest-1',
                voterKey: 'voter-1',
                electionVoterKey: null,
                voteType: 'PAID',
                voteCount: 3,
                paymentIntentId: 'pi-1',
                metadataJson: null,
                createdAt: new Date(),
            }),
        });
        const result = await service.applyPaidVoteGrant({ paymentIntentId: 'pi-1' });
        (0, vitest_1.expect)(result.idempotent).toBe(true);
        (0, vitest_1.expect)(result.voteGrant.id).toBe('grant-2');
    });
});
//# sourceMappingURL=VotingService.test.js.map