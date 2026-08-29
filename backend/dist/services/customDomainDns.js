"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCustomDomainDns = verifyCustomDomainDns;
exports.buildDomainVerificationNote = buildDomainVerificationNote;
const node_dns_1 = require("node:dns");
const dnsErrorLabel = (error) => {
    if (!error || typeof error !== 'object')
        return 'DNS lookup failed';
    const candidate = error;
    return candidate.code || candidate.message || 'DNS lookup failed';
};
const normalizeHost = (host) => host.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
async function verifyCustomDomainDns(host, verificationToken, cnameTarget, apexTarget) {
    const canonicalHost = normalizeHost(host);
    const txtHost = `_eventpeepo.${canonicalHost}`;
    const cnameHost = `www.${canonicalHost}`;
    const apexHost = canonicalHost;
    const expectedCnameValue = cnameTarget.trim().toLowerCase().replace(/\.$/, '');
    const expectedApexValue = apexTarget.trim();
    let observedTxtValues = [];
    let observedCnameValues = [];
    let observedApexValues = [];
    let txtError;
    let cnameError;
    let apexError;
    try {
        const records = await node_dns_1.promises.resolveTxt(txtHost);
        // TXT RRs can be split into multiple character-string chunks.
        observedTxtValues = records.map((parts) => parts.join('').trim());
    }
    catch (error) {
        txtError = dnsErrorLabel(error);
    }
    try {
        const records = await node_dns_1.promises.resolveCname(cnameHost);
        observedCnameValues = records.map((record) => record.toLowerCase().replace(/\.$/, ''));
    }
    catch (error) {
        cnameError = dnsErrorLabel(error);
    }
    try {
        observedApexValues = await node_dns_1.promises.resolve4(apexHost);
    }
    catch (error) {
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
function buildDomainVerificationNote(result) {
    if (result.verified)
        return null;
    const failures = [];
    if (!result.txtMatch) {
        failures.push(result.txtError
            ? `TXT lookup failed for ${result.txtHost} (${result.txtError})`
            : `TXT mismatch at ${result.txtHost}; expected ${result.expectedTxtValue}${result.observedTxtValues.length ? `, found ${result.observedTxtValues.join(', ')}` : ', found no TXT value'}`);
    }
    if (!result.cnameMatch) {
        failures.push(result.cnameError
            ? `CNAME lookup failed for ${result.cnameHost} (${result.cnameError})`
            : `CNAME mismatch at ${result.cnameHost}; expected ${result.expectedCnameValue}${result.observedCnameValues.length ? `, found ${result.observedCnameValues.join(', ')}` : ', found no CNAME value'}`);
    }
    if (!result.apexMatch) {
        failures.push(result.apexError
            ? `A-record lookup failed for ${result.apexHost} (${result.apexError})`
            : `A-record mismatch at ${result.apexHost}; expected ${result.expectedApexValue}${result.observedApexValues.length ? `, found ${result.observedApexValues.join(', ')}` : ', found no IPv4 value'}`);
    }
    return failures.join(' | ');
}
//# sourceMappingURL=customDomainDns.js.map