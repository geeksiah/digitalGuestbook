"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoterIdentityService = void 0;
const crypto_1 = require("crypto");
const errorHandler_js_1 = require("../../../middleware/errorHandler.js");
const DEFAULT_GHANA_DIAL_CODE = '233';
class VoterIdentityService {
    pepper;
    constructor(pepper = process.env.USSD_PEPPER || process.env.JWT_SECRET || '') {
        if (!pepper) {
            throw new errorHandler_js_1.AppError('USSD_PEPPER or JWT_SECRET must be configured', 500);
        }
        this.pepper = pepper;
    }
    normalizeMsisdn(input) {
        const trimmed = String(input || '').trim();
        if (!trimmed)
            throw new errorHandler_js_1.AppError('Phone number is required', 400);
        const normalized = trimmed.replace(/[^\d+]/g, '');
        if (!normalized)
            throw new errorHandler_js_1.AppError('Phone number is required', 400);
        if (normalized.startsWith('+')) {
            return `+${normalized.slice(1).replace(/\D/g, '')}`;
        }
        const digits = normalized.replace(/\D/g, '');
        if (digits.startsWith(DEFAULT_GHANA_DIAL_CODE)) {
            return `+${digits}`;
        }
        if (digits.startsWith('0') && digits.length >= 10) {
            return `+${DEFAULT_GHANA_DIAL_CODE}${digits.slice(1)}`;
        }
        return `+${digits}`;
    }
    deriveVoterKey(input) {
        const { eventId, scopeKey, msisdnNormalized } = input;
        const payload = `${eventId}:${scopeKey}:${msisdnNormalized}`;
        return (0, crypto_1.createHmac)('sha256', this.pepper).update(payload).digest('hex');
    }
}
exports.VoterIdentityService = VoterIdentityService;
//# sourceMappingURL=VoterIdentityService.js.map