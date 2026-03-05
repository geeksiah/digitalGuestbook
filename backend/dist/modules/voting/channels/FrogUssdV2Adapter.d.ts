import { UssdCreditsService } from '../credits/UssdCreditsService.js';
import { VoterIdentityService } from '../core/VoterIdentityService.js';
import { VotingService } from '../core/VotingService.js';
import type { IVotingChannelAdapter } from './IVotingChannelAdapter.js';
export type FrogAdapterResponse = {
    network: string;
    sessionid: string;
    mode: 'MORE' | 'END';
    userdata: string;
    username: string;
    trafficid: string;
    other?: string;
    msisdn?: string;
    phonenumber?: string;
};
export declare class FrogUssdV2Adapter implements IVotingChannelAdapter<unknown, FrogAdapterResponse> {
    private readonly votingService;
    private readonly creditsService;
    private readonly identityService;
    private readonly renderer;
    private readonly machine;
    constructor(votingService: VotingService, creditsService: UssdCreditsService, identityService: VoterIdentityService);
    handleRequest(rawInput: unknown): Promise<FrogAdapterResponse>;
    private parseSessionContext;
    private storeTraffic;
    private reply;
}
//# sourceMappingURL=FrogUssdV2Adapter.d.ts.map