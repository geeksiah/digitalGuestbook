import { describe, expect, it } from 'vitest';
import { VoterIdentityService } from './VoterIdentityService.js';

describe('VoterIdentityService', () => {
  const service = new VoterIdentityService('test-pepper');

  it('normalizes local Ghana number to +233 format', () => {
    expect(service.normalizeMsisdn('0244 123 456')).toBe('+233244123456');
  });

  it('accepts msisdn with country code', () => {
    expect(service.normalizeMsisdn('233244123456')).toBe('+233244123456');
    expect(service.normalizeMsisdn('+233244123456')).toBe('+233244123456');
  });

  it('derives deterministic voter keys', () => {
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
    expect(keyA).toBe(keyB);
    expect(keyA).toHaveLength(64);
  });
});

