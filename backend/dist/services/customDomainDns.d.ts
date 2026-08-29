export interface DomainDnsVerificationResult {
    verified: boolean;
    txtMatch: boolean;
    cnameMatch: boolean;
    apexMatch: boolean;
    txtHost: string;
    cnameHost: string;
    apexHost: string;
    expectedTxtValue: string;
    expectedCnameValue: string;
    expectedApexValue: string;
    observedTxtValues: string[];
    observedCnameValues: string[];
    observedApexValues: string[];
    txtError?: string;
    cnameError?: string;
    apexError?: string;
}
export declare function verifyCustomDomainDns(host: string, verificationToken: string, cnameTarget: string, apexTarget: string): Promise<DomainDnsVerificationResult>;
export declare function buildDomainVerificationNote(result: DomainDnsVerificationResult): string | null;
//# sourceMappingURL=customDomainDns.d.ts.map