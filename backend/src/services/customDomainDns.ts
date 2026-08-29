import { promises as dns } from 'node:dns';

export interface DomainDnsVerificationResult {
  verified: boolean;
  txtMatch: boolean;
  cnameMatch: boolean;
  txtHost: string;
  cnameHost: string;
  expectedTxtValue: string;
  expectedCnameValue: string;
  observedTxtValues: string[];
  observedCnameValues: string[];
  txtError?: string;
  cnameError?: string;
}

const dnsErrorLabel = (error: unknown) => {
  if (!error || typeof error !== 'object') return 'DNS lookup failed';
  const candidate = error as { code?: string; message?: string };
  return candidate.code || candidate.message || 'DNS lookup failed';
};

export async function verifyCustomDomainDns(
  host: string,
  verificationToken: string,
  cnameTarget: string,
): Promise<DomainDnsVerificationResult> {
  const canonicalHost = host.trim().toLowerCase().replace(/\.$/, '');
  const txtHost = `_eventpeepo.${canonicalHost}`;
  const cnameHost = canonicalHost.startsWith('www.') ? canonicalHost : `www.${canonicalHost}`;
  const expectedCnameValue = cnameTarget.trim().toLowerCase().replace(/\.$/, '');

  let observedTxtValues: string[] = [];
  let observedCnameValues: string[] = [];
  let txtError: string | undefined;
  let cnameError: string | undefined;

  try {
    const records = await dns.resolveTxt(txtHost);
    // A single TXT RR can be split into multiple character-string chunks.
    // Join each RR's chunks instead of flattening them into separate values.
    observedTxtValues = records.map((parts) => parts.join('').trim());
  } catch (error) {
    txtError = dnsErrorLabel(error);
  }

  try {
    const records = await dns.resolveCname(cnameHost);
    observedCnameValues = records.map((record) => record.toLowerCase().replace(/\.$/, ''));
  } catch (error) {
    cnameError = dnsErrorLabel(error);
  }

  const txtMatch = observedTxtValues.includes(verificationToken);
  const cnameMatch = observedCnameValues.includes(expectedCnameValue);

  return {
    verified: txtMatch && cnameMatch,
    txtMatch,
    cnameMatch,
    txtHost,
    cnameHost,
    expectedTxtValue: verificationToken,
    expectedCnameValue,
    observedTxtValues,
    observedCnameValues,
    ...(txtError ? { txtError } : {}),
    ...(cnameError ? { cnameError } : {}),
  };
}

export function buildDomainVerificationNote(result: DomainDnsVerificationResult) {
  if (result.verified) return null;

  const failures: string[] = [];
  if (!result.txtMatch) {
    failures.push(
      result.txtError
        ? `TXT lookup failed for ${result.txtHost} (${result.txtError})`
        : `TXT mismatch at ${result.txtHost}; expected ${result.expectedTxtValue}${result.observedTxtValues.length ? `, found ${result.observedTxtValues.join(', ')}` : ', found no TXT value'}`,
    );
  }
  if (!result.cnameMatch) {
    failures.push(
      result.cnameError
        ? `CNAME lookup failed for ${result.cnameHost} (${result.cnameError})`
        : `CNAME mismatch at ${result.cnameHost}; expected ${result.expectedCnameValue}${result.observedCnameValues.length ? `, found ${result.observedCnameValues.join(', ')}` : ', found no CNAME value'}`,
    );
  }
  return failures.join(' | ');
}
