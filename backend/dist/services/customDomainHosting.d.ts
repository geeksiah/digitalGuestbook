export interface HostingProvisionResult {
    attempted: boolean;
    aliasesConfigured: boolean;
    tlsReady: boolean;
    configured: boolean;
    aliases: string[];
    certificateDomains: string[];
    certificateState?: string;
    error?: string;
}
export interface HostingRemovalResult {
    attempted: boolean;
    aliasesRemoved: boolean;
    aliases: string[];
    tlsRefreshRequested: boolean;
    error?: string;
}
export declare const getCustomDomainAliases: (host: string) => string[];
export declare const isNetlifyDomainAutomationConfigured: () => boolean;
/**
 * Read-only hosting/TLS status check. VERIFIED means EventPeepo has proven DNS
 * ownership; ACTIVE is reserved for domains whose aliases and certificate are
 * both ready on Netlify.
 */
export declare function checkCustomDomainOnNetlify(host: string): Promise<HostingProvisionResult>;
/**
 * Attach both apex + www as aliases on the existing EventPeepo Netlify site,
 * then request Let's Encrypt provisioning/renewal. The primary site domain is
 * never changed.
 */
export declare function provisionCustomDomainOnNetlify(host: string): Promise<HostingProvisionResult>;
/**
 * Remove one or more customer domains from the site's alias list. Alias removal
 * is the critical routing cleanup. A certificate refresh is requested afterwards
 * so stale customer SANs are removed from the next managed certificate too.
 */
export declare function removeCustomDomainsFromNetlify(hosts: string[]): Promise<HostingRemovalResult>;
export declare const removeCustomDomainFromNetlify: (host: string) => Promise<HostingRemovalResult>;
//# sourceMappingURL=customDomainHosting.d.ts.map