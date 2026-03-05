"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const VoterIdentityService_js_1 = require("./VoterIdentityService.js");
(0, vitest_1.describe)('VoterIdentityService', () => {
    const service = new VoterIdentityService_js_1.VoterIdentityService('test-pepper');
    (0, vitest_1.it)('normalizes local Ghana number to +233 format', () => {
        (0, vitest_1.expect)(service.normalizeMsisdn('0244 123 456')).toBe('+233244123456');
    });
    (0, vitest_1.it)('accepts msisdn with country code', () => {
        (0, vitest_1.expect)(service.normalizeMsisdn('233244123456')).toBe('+233244123456');
        (0, vitest_1.expect)(service.normalizeMsisdn('+233244123456')).toBe('+233244123456');
    });
    (0, vitest_1.it)('derives deterministic voter keys', () => {
        const keyA = service.deriveVoterKey({
            eventId: 'evt-1',
            scopeKey: 'contest-1',
            msisdnNormalized: '+233244123456',
        });
        const keyB = service.deriveVoterKey({
            eventId: 'evt-1',
            scopeKey: 'contest-1',
            msisdnNormalized: '+233244123456',
        });
        (0, vitest_1.expect)(keyA).toBe(keyB);
        (0, vitest_1.expect)(keyA).toHaveLength(64);
    });
});
//# sourceMappingURL=VoterIdentityService.test.js.map