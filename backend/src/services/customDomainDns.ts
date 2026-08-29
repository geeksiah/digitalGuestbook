import { promises as dns } from 'node:dns';

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

const dnsErrorLabel = (error: unknown) => {
  if (!error || typeof error !== 'object') return 'DNS lookup failed';
  const candidate = error as { code?: string; message?: string };
  return candidate.code || candidate.message || 'DNS lookup failed';
};

const normalizeHost = (host: string) =>
  host.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

export async function verifyCustomDomainDns(
  host: string,
  verificationToken: string,
  cnameTarget: string,
  apexTarget: string,
): Promise<DomainDnsVerificationResult> {
  const canonicalHost = normalizeHost(host);
  const txtHost = `_eventpeepo.${canonicalHost}`;
  const cnameHost = `www.${canonicalHost}`;
  const apexHost = canonicalHost;
  const expectedCnameValue = cnameTarget.trim().toLowerCase().replace(/\.$/, '');
  const expectedApexValue = apexTarget.trim();

  let observedTxtValues: string[] = [];
  let observedCnameValues: string[] = [];
  let observedApexValues: string[] = [];
  let txtError: string | undefined;
  let cnameError: string | undefined;
  let apexError: string | undefined;

  try {
    const records = await dns.resolveTxt(txtHost);
    // TXT RRs can be split into multiple character-string chunks.
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

  try {
    observedApexValues = await dns.resolve4(apexHost);
  } catch (error) {
    apexError = dnsErrorLabel(error);
  }

  const txtMatch = observedTxtValues.includes(verificationToken);
  const cnameMatch = observedCnameValues.includes(expectedCnameValue);
  const apexMatch = observedApexValues.includes(expectedApexValue);

  return {
    verified: txtMatch && cnameMatch && apexMatch,
    txtMatch,
    cnameMatch,
    apexMatch,
    txtHost,
    cnameHost,
    apexHost,
    expectedTxtValue: verificationToken,
    expectedCnameValue,
    expectedApexValue,
    observedTxtValues,
    observedCnameValues,
    observedApexValues,
    ...(txtError ? { txtError } : {}),
    ...(cnameError ? { cnameError } : {}),
    ...(apexError ? { apexError } : {}),
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
  if (!result.apexMatch) {
    failures.push(
      result.apexError
        ? `A-record lookup failed for ${result.apexHost} (${result.apexError})`
        : `A-record mismatch at ${result.apexHost}; expected ${result.expectedApexValue}${result.observedApexValues.length ? `, found ${result.observedApexValues.join(', ')}` : ', found no IPv4 value'}`,
    );
  }
  return failures.join(' | ');
}
