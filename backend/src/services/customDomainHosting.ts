export interface HostingProvisionResult {
  attempted: boolean;
  configured: boolean;
  aliases: string[];
  error?: string;
}

const normalizeHost = (host: string) => host.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

export const getCustomDomainAliases = (host: string) => {
  const canonical = normalizeHost(host);
  return [canonical, `www.${canonical}`];
};

/**
 * Register the customer hostname(s) as aliases on the Netlify site that serves
 * the EventPeepo frontend. Netlify must know about each hostname so it can
 * route the Host header and provision HTTPS certificates.
 *
 * If NETLIFY_SITE_ID / NETLIFY_AUTH_TOKEN are not configured, this function
 * deliberately does not fail DNS verification; it returns a clear manual-action
 * message instead. This keeps existing deployments backwards compatible while
 * making the missing hosting step visible.
 */
export async function provisionCustomDomainOnNetlify(host: string): Promise<HostingProvisionResult> {
  const aliases = getCustomDomainAliases(host);
  const siteId = String(process.env.NETLIFY_SITE_ID || '').trim();
  const authToken = String(process.env.NETLIFY_AUTH_TOKEN || '').trim();

  if (!siteId || !authToken) {
    return {
      attempted: false,
      configured: false,
      aliases,
      error: 'DNS is verified, but automatic Netlify domain provisioning is not configured. Add NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN, or add both domain aliases manually in Netlify.',
    };
  }

  const endpoint = `https://api.netlify.com/api/v1/sites/${encodeURIComponent(siteId)}`;
  const headers = {
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
  };

  try {
    const currentResponse = await fetch(endpoint, { headers });
    if (!currentResponse.ok) {
      const detail = await currentResponse.text().catch(() => '');
      return {
        attempted: true,
        configured: false,
        aliases,
        error: `Netlify site lookup failed (${currentResponse.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`,
      };
    }

    const current = await currentResponse.json() as {
      custom_domain?: string | null;
      domain_aliases?: string[] | null;
    };

    const existing = Array.isArray(current.domain_aliases) ? current.domain_aliases : [];
    const protectedHosts = new Set([
      ...(current.custom_domain ? [current.custom_domain.toLowerCase()] : []),
      ...existing.map((value) => value.toLowerCase()),
    ]);
    aliases.forEach((alias) => protectedHosts.add(alias));

    const patchResponse = await fetch(endpoint, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ domain_aliases: Array.from(protectedHosts) }),
    });

    if (!patchResponse.ok) {
      const detail = await patchResponse.text().catch(() => '');
      return {
        attempted: true,
        configured: false,
        aliases,
        error: `Netlify domain alias update failed (${patchResponse.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`,
      };
    }

    return { attempted: true, configured: true, aliases };
  } catch (error) {
    return {
      attempted: true,
      configured: false,
      aliases,
      error: `Netlify domain provisioning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
