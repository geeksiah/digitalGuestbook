import { createHmac } from 'crypto';
import { AppError } from '../../../middleware/errorHandler.js';

const DEFAULT_GHANA_DIAL_CODE = '233';

export class VoterIdentityService {
  private readonly pepper: string;

  constructor(pepper = process.env.USSD_PEPPER || process.env.JWT_SECRET || '') {
    if (!pepper) {
      throw new AppError('USSD_PEPPER or JWT_SECRET must be configured', 500);
    }
    this.pepper = pepper;
  }

  normalizeMsisdn(input: string): string {
    const trimmed = String(input || '').trim();
    if (!trimmed) throw new AppError('Phone number is required', 400);

    const normalized = trimmed.replace(/[^\d+]/g, '');
    if (!normalized) throw new AppError('Phone number is required', 400);

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

  deriveVoterKey(input: { eventId: string; scopeKey: string; msisdnNormalized: string }): string {
    const { eventId, scopeKey, msisdnNormalized } = input;
    const payload = `${eventId}:${scopeKey}:${msisdnNormalized}`;
    return createHmac('sha256', this.pepper).update(payload).digest('hex');
  }
}

