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

type NetlifySite = {
  custom_domain?: string | null;
  domain_aliases?: string[] | null;
};

type NetlifyCertificate = {
  state?: string | null;
  domains?: string[] | null;
  expires_at?: string | null;
};

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

const NETLIFY_API = 'https://api.netlify.com/api/v1';

const normalizeHost = (host: string) =>
  host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/\.$/, '');

const normalizeAlias = (host: string) => host.trim().toLowerCase().replace(/\.$/, '');

export const getCustomDomainAliases = (host: string) => {
  const canonical = normalizeHost(host);
  return canonical ? [canonical, `www.${canonical}`] : [];
};

const getNetlifyConfig = () => ({
  siteId: String(process.env.NETLIFY_SITE_ID || '').trim(),
  authToken: String(process.env.NETLIFY_AUTH_TOKEN || '').trim(),
});

export const isNetlifyDomainAutomationConfigured = () => {
  const { siteId, authToken } = getNetlifyConfig();
  return Boolean(siteId && authToken);
};

const netlifyHeaders = (authToken: string) => ({
  Authorization: `Bearer ${authToken}`,
  'Content-Type': 'application/json',
});

const readResponseDetail = async (response: FetchResponse) => {
  const detail = await response.text().catch(() => '');
  return detail ? `: ${detail.slice(0, 300)}` : '';
};

async function getNetlifySite(siteId: string, authToken: string): Promise<NetlifySite> {
  const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}`, {
    headers: netlifyHeaders(authToken),
  });
  if (!response.ok) {
    throw new Error(`Netlify site lookup failed (${response.status})${await readResponseDetail(response)}`);
  }
  return response.json() as Promise<NetlifySite>;
}

async function getNetlifyCertificate(
  siteId: string,
  authToken: string,
): Promise<NetlifyCertificate | null> {
  const response = await fetch(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}/ssl`, {
    headers: netlifyHeaders(authToken),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Netlify certificate lookup failed (${response.status})${await readResponseDetail(response)}`);
  }
  return response.json() as Promise<NetlifyCertificate>;
}

const certificateCovers = (certificate: NetlifyCertificate | null, aliases: string[]) => {
  if (!certificate) return false;
  const domains = new Set((certificate.domains || []).map(normalizeAlias));
  return aliases.every((alias) => domains.has(normalizeAlias(alias)));
};

async function requestTlsRefresh(
  siteId: string,
  authToken: string,
  hasExistingCertificate: boolean,
): Promise<NetlifyCertificate | null> {
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
  if (!contentType.includes('application/json')) return null;
  return response.json().catch(() => null) as Promise<NetlifyCertificate | null>;
}

/**
 * Read-only hosting/TLS status check. VERIFIED means EventPeepo has proven DNS
 * ownership; ACTIVE is reserved for domains whose aliases and certificate are
 * both ready on Netlify.
 */
export async function checkCustomDomainOnNetlify(host: string): Promise<HostingProvisionResult> {
  const aliases = getCustomDomainAliases(host);
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
  } catch (error) {
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
export async function provisionCustomDomainOnNetlify(host: string): Promise<HostingProvisionResult> {
  const aliases = getCustomDomainAliases(host);
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
        if (refreshed) certificate = refreshed;
      } catch (error) {
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
  } catch (error) {
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
export async function removeCustomDomainsFromNetlify(hosts: string[]): Promise<HostingRemovalResult> {
  const aliases = Array.from(new Set(hosts.flatMap(getCustomDomainAliases).map(normalizeAlias)));
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
    let tlsWarning: string | undefined;
    try {
      const certificate = await getNetlifyCertificate(siteId, authToken);
      if (certificate) {
        await requestTlsRefresh(siteId, authToken, true);
        tlsRefreshRequested = true;
      }
    } catch (error) {
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
  } catch (error) {
    return {
      attempted: true,
      aliasesRemoved: false,
      aliases,
      tlsRefreshRequested: false,
      error: error instanceof Error ? error.message : 'Unknown Netlify cleanup error',
    };
  }
}

export const removeCustomDomainFromNetlify = (host: string) =>
  removeCustomDomainsFromNetlify([host]);
