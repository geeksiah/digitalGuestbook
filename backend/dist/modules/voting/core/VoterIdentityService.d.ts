export declare class VoterIdentityService {
    private readonly pepper;
    constructor(pepper?: string);
    normalizeMsisdn(input: string): string;
    deriveVoterKey(input: {
        eventId: string;
        scopeKey: string;
        msisdnNormalized: string;
    }): string;
}
//# sourceMappingURL=VoterIdentityService.d.ts.map