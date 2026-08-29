"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeCustomDomainFromNetlify = exports.isNetlifyDomainAutomationConfigured = exports.getCustomDomainAliases = void 0;
exports.checkCustomDomainOnNetlify = checkCustomDomainOnNetlify;
exports.provisionCustomDomainOnNetlify = provisionCustomDomainOnNetlify;
exports.removeCustomDomainsFromNetlify = removeCustomDomainsFromNetlify;
const NETLIFY_API = 'https://api.netlify.com/api/v1';
const normalizeHost = (host) => host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/\.$/, '');
const normalizeAlias = (host) => host.trim().toLowerCase().replace(/\.$/, '');
const getCustomDomainAliases = (host) => {
    const canonical = normalizeHost(host);
    return canonical ? [canonical, `www.${canonical}`] : [];
};
exports.getCustomDomainAliases = getCustomDomainAliases;
const getNetlifyConfig = () => ({
    siteId: String(process.env.NETLIFY_SITE_ID || '').trim(),
    authToken: String(process.env.NETLIFY_AUTH_TOKEN || '').trim(),
});
const isNetlifyDomainAutomationConfigured = () => {
    const { siteId, authToken } = getNetlifyConfig();
    return Boolean(siteId && authToken);
};
exports.isNetlifyDomainAutomationConfigured = isNetlifyDomainAutomationConfigured;
const netlifyHeaders = (authToken) => ({
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
});
const readResponseDetail = async (response) => {
    const detail = await response.text().catch(() => '');
    return detail ? `: ${detail.slice(0, 300)}` : '';
};
async function getNetlifySite(siteId, authToken) {
    const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}`, {
        headers: netlifyHeaders(authToken),
    });
    if (!response.ok) {
        throw new Error(`Netlify site lookup failed (${response.status})${await readResponseDetail(response)}`);
    }
    return response.json();
}
async function getNetlifyCertificate(siteId, authToken) {
    const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}/ssl`, {
        headers: netlifyHeaders(authToken),
    });
    if (response.status === 404)
        return null;
    if (!response.ok) {
        throw new Error(`Netlify certificate lookup failed (${response.status})${await readResponseDetail(response)}`);
    }
    return response.json();
}
const certificateCovers = (certificate, aliases) => {
    if (!certificate)
        return false;
    const domains = new Set((certificate.domains || []).map(normalizeAlias));
    return aliases.every((alias) => domains.has(normalizeAlias(alias)));
};
async function requestTlsRefresh(siteId, authToken, hasExistingCertificate) {
    // Netlify requires /ssl/renew when a Let's Encrypt certificate already exists.
    const suffix = hasExistingCertificate ? '/ssl/renew' : '/ssl';
    const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}${suffix}`, {
        method: 'POST',
        headers: netlifyHeaders(authToken),
    });
    if (!response.ok) {
        throw new Error(`Netlify TLS provisioning failed (${response.status})${await readResponseDetail(response)}`);
    }
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json'))
        return null;
    return response.json().catch(() => null);
}
/**
 * Read-only hosting/TLS status check. VERIFIED means EventPeepo has proven DNS
 * ownership; ACTIVE is reserved for domains whose aliases and certificate are
 * both ready on Netlify.
 */
async function checkCustomDomainOnNetlify(host) {
    const aliases = (0, exports.getCustomDomainAliases)(host);
    const { siteId, authToken } = getNetlifyConfig();
    if (!siteId || !authToken) {
        return {
            attempted: false,
            aliasesConfigured: false,
            tlsReady: false,
            configured: false,
            aliases,
            certificateDomains: [],
            error: 'Automatic Netlify custom-domain hosting is not configured. Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN.',
        };
    }
    try {
        const site = await getNetlifySite(siteId, authToken);
        const existingAliases = new Set((site.domain_aliases || []).map(normalizeAlias));
        const aliasesConfigured = aliases.every((alias) => existingAliases.has(normalizeAlias(alias)));
        const certificate = await getNetlifyCertificate(siteId, authToken);
        const certificateDomains = (certificate?.domains || []).map(normalizeAlias);
        const tlsReady = aliasesConfigured && certificateCovers(certificate, aliases);
        return {
            attempted: true,
            aliasesConfigured,
            tlsReady,
            configured: aliasesConfigured && tlsReady,
            aliases,
            certificateDomains,
            ...(certificate?.state ? { certificateState: certificate.state } : {}),
            ...(!aliasesConfigured
                ? { error: 'Netlify has not attached all required aliases yet.' }
                : !tlsReady
                    ? { error: 'Netlify aliases are attached, but the Let\'s Encrypt certificate is still provisioning.' }
                    : {}),
        };
    }
    catch (error) {
        return {
            attempted: true,
            aliasesConfigured: false,
            tlsReady: false,
            configured: false,
            aliases,
            certificateDomains: [],
            error: error instanceof Error ? error.message : 'Unknown Netlify hosting error',
        };
    }
}
/**
 * Attach both apex + www as aliases on the existing EventPeepo Netlify site,
 * then request Let's Encrypt provisioning/renewal. The primary site domain is
 * never changed.
 */
async function provisionCustomDomainOnNetlify(host) {
    const aliases = (0, exports.getCustomDomainAliases)(host);
    const { siteId, authToken } = getNetlifyConfig();
    if (!siteId || !authToken) {
        return {
            attempted: false,
            aliasesConfigured: false,
            tlsReady: false,
            configured: false,
            aliases,
            certificateDomains: [],
            error: 'DNS is verified, but automatic Netlify provisioning is not configured. Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN.',
        };
    }
    try {
        const site = await getNetlifySite(siteId, authToken);
        const existingAliases = (site.domain_aliases || []).map(normalizeAlias);
        const merged = new Set(existingAliases);
        aliases.forEach((alias) => merged.add(normalizeAlias(alias)));
        const needsAliasUpdate = aliases.some((alias) => !existingAliases.includes(normalizeAlias(alias)));
        if (needsAliasUpdate) {
            const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}`, {
                method: 'PATCH',
                headers: netlifyHeaders(authToken),
                body: JSON.stringify({ domain_aliases: Array.from(merged) }),
            });
            if (!response.ok) {
                throw new Error(`Netlify domain alias update failed (${response.status})${await readResponseDetail(response)}`);
            }
        }
        let certificate = await getNetlifyCertificate(siteId, authToken);
        if (!certificateCovers(certificate, aliases)) {
            try {
                const refreshed = await requestTlsRefresh(siteId, authToken, Boolean(certificate));
                if (refreshed)
                    certificate = refreshed;
            }
            catch (error) {
                // Alias attachment succeeded; keep VERIFIED while Netlify/Let's Encrypt
                // completes provisioning or retries automatically.
                return {
                    attempted: true,
                    aliasesConfigured: true,
                    tlsReady: false,
                    configured: false,
                    aliases,
                    certificateDomains: (certificate?.domains || []).map(normalizeAlias),
                    ...(certificate?.state ? { certificateState: certificate.state } : {}),
                    error: error instanceof Error ? error.message : 'Netlify TLS provisioning is pending',
                };
            }
        }
        if (!certificateCovers(certificate, aliases)) {
            certificate = await getNetlifyCertificate(siteId, authToken).catch(() => certificate);
        }
        const certificateDomains = (certificate?.domains || []).map(normalizeAlias);
        const tlsReady = certificateCovers(certificate, aliases);
        return {
            attempted: true,
            aliasesConfigured: true,
            tlsReady,
            configured: tlsReady,
            aliases,
            certificateDomains,
            ...(certificate?.state ? { certificateState: certificate.state } : {}),
            ...(!tlsReady
                ? { error: 'Netlify aliases are attached. Let\'s Encrypt certificate provisioning is still in progress.' }
                : {}),
        };
    }
    catch (error) {
        return {
            attempted: true,
            aliasesConfigured: false,
            tlsReady: false,
            configured: false,
            aliases,
            certificateDomains: [],
            error: error instanceof Error ? error.message : 'Unknown Netlify provisioning error',
        };
    }
}
/**
 * Remove one or more customer domains from the site's alias list. Alias removal
 * is the critical routing cleanup. A certificate refresh is requested afterwards
 * so stale customer SANs are removed from the next managed certificate too.
 */
async function removeCustomDomainsFromNetlify(hosts) {
    const aliases = Array.from(new Set(hosts.flatMap(exports.getCustomDomainAliases).map(normalizeAlias)));
    if (aliases.length === 0) {
        return { attempted: false, aliasesRemoved: true, aliases: [], tlsRefreshRequested: false };
    }
    const { siteId, authToken } = getNetlifyConfig();
    if (!siteId || !authToken) {
        return {
            attempted: false,
            aliasesRemoved: false,
            aliases,
            tlsRefreshRequested: false,
            error: 'Netlify cleanup is not configured. Set NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN before removing a hosted custom domain.',
        };
    }
    try {
        const site = await getNetlifySite(siteId, authToken);
        const aliasesToRemove = new Set(aliases);
        const existing = (site.domain_aliases || []).map(normalizeAlias);
        const remaining = existing.filter((alias) => !aliasesToRemove.has(alias));
        if (remaining.length !== existing.length) {
            const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}`, {
                method: 'PATCH',
                headers: netlifyHeaders(authToken),
                body: JSON.stringify({ domain_aliases: remaining }),
            });
            if (!response.ok) {
                throw new Error(`Netlify domain alias removal failed (${response.status})${await readResponseDetail(response)}`);
            }
        }
        const confirmedSite = await getNetlifySite(siteId, authToken);
        const confirmedAliases = new Set((confirmedSite.domain_aliases || []).map(normalizeAlias));
        const aliasesRemoved = aliases.every((alias) => !confirmedAliases.has(alias));
        if (!aliasesRemoved) {
            return {
                attempted: true,
                aliasesRemoved: false,
                aliases,
                tlsRefreshRequested: false,
                error: 'Netlify still reports one or more removed customer aliases.',
            };
        }
        let tlsRefreshRequested = false;
        let tlsWarning;
        try {
            const certificate = await getNetlifyCertificate(siteId, authToken);
            if (certificate) {
                await requestTlsRefresh(siteId, authToken, true);
                tlsRefreshRequested = true;
            }
        }
        catch (error) {
            // Routing has already been removed. Preserve the warning, but do not keep
            // a database record solely because Netlify's certificate refresh is async.
            tlsWarning = error instanceof Error ? error.message : 'Netlify TLS refresh could not be requested';
        }
        return {
            attempted: true,
            aliasesRemoved: true,
            aliases,
            tlsRefreshRequested,
            ...(tlsWarning ? { error: `Aliases removed, but certificate refresh warning: ${tlsWarning}` } : {}),
        };
    }
    catch (error) {
        return {
            attempted: true,
            aliasesRemoved: false,
            aliases,
            tlsRefreshRequested: false,
            error: error instanceof Error ? error.message : 'Unknown Netlify cleanup error',
        };
    }
}
const removeCustomDomainFromNetlify = (host) => removeCustomDomainsFromNetlify([host]);
exports.removeCustomDomainFromNetlify = removeCustomDomainFromNetlify;
//# sourceMappingURL=customDomainHosting.js.map