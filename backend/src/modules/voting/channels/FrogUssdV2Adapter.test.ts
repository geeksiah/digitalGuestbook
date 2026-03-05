import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../../utils/prisma.js';
import { FrogUssdV2Adapter } from './FrogUssdV2Adapter.js';

const setPrismaMocks = () => {
  (prisma as any).ussdChannelBinding = {
    findFirst: vi.fn().mockResolvedValue(null),
  };
  (prisma as any).ussdSession = {
    upsert: vi.fn(),
    update: vi.fn(),
  };
  (prisma as any).ussdTrafficLog = {
    findFirst: vi.fn(),
    create: vi.fn(),
  };
  (prisma as any).votingEventConfig = {
    findUnique: vi.fn(),
  };
};

describe('FrogUssdV2Adapter', () => {
  beforeEach(() => {
    setPrismaMocks();
  });

  it('accepts phonenumber payload field', async () => {
    const adapter = new FrogUssdV2Adapter(
      { listContests: vi.fn(), listOptions: vi.fn(), castElectionVote: vi.fn(), castFreeAwardVote: vi.fn() } as any,
      { ensureWalletForEvent: vi.fn(), consumeCredits: vi.fn() } as any,
      { normalizeMsisdn: vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vi.fn() } as any
    );

    const response = await adapter.handleRequest({
      network: 'MTN',
      sessionid: 'sess-1',
      mode: 'START',
      phonenumber: '0244123456',
      userdata: '',
      username: 'channel-a',
      trafficid: 't-1',
    });

    expect(response.mode).toBe('END');
    expect(response.phonenumber).toBe('0244123456');
  });

  it('accepts msisdn payload field', async () => {
    const adapter = new FrogUssdV2Adapter(
      { listContests: vi.fn(), listOptions: vi.fn(), castElectionVote: vi.fn(), castFreeAwardVote: vi.fn() } as any,
      { ensureWalletForEvent: vi.fn(), consumeCredits: vi.fn() } as any,
      { normalizeMsisdn: vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vi.fn() } as any
    );

    const response = await adapter.handleRequest({
      network: 'MTN',
      sessionid: 'sess-2',
      mode: 'MORE',
      msisdn: '+233244123456',
      userdata: '1',
      username: 'channel-a',
      trafficid: 't-2',
    });

    expect(response.mode).toBe('END');
    expect(response.msisdn).toBe('+233244123456');
  });

  it('tolerates END mode input', async () => {
    const adapter = new FrogUssdV2Adapter(
      { listContests: vi.fn(), listOptions: vi.fn(), castElectionVote: vi.fn(), castFreeAwardVote: vi.fn() } as any,
      { ensureWalletForEvent: vi.fn(), consumeCredits: vi.fn() } as any,
      { normalizeMsisdn: vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vi.fn() } as any
    );

    const response = await adapter.handleRequest({
      network: 'MTN',
      sessionid: 'sess-2-end',
      mode: 'END',
      msisdn: '+233244123456',
      userdata: '',
      username: 'channel-a',
      trafficid: 't-2-end',
    });

    expect(response.mode).toBe('END');
  });

  it('ends session politely when credits are insufficient', async () => {
    (prisma as any).ussdChannelBinding.findFirst.mockResolvedValue({
      id: 'binding-1',
      eventId: 'event-1',
      ussdChannelId: 'channel-1',
      ussdChannel: { id: 'channel-1' },
    });
    (prisma as any).ussdSession.upsert.mockResolvedValue({
      id: 'session-db-1',
      state: 'WELCOME',
      contextJson: null,
    });
    (prisma as any).ussdTrafficLog.findFirst.mockResolvedValue(null);

    const adapter = new FrogUssdV2Adapter(
      { listContests: vi.fn(), listOptions: vi.fn(), castElectionVote: vi.fn(), castFreeAwardVote: vi.fn() } as any,
      {
        ensureWalletForEvent: vi.fn().mockResolvedValue({ id: 'wallet-1' }),
        consumeCredits: vi.fn().mockResolvedValue({ status: 'insufficient' }),
      } as any,
      { normalizeMsisdn: vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vi.fn() } as any
    );

    const response = await adapter.handleRequest({
      network: 'MTN',
      sessionid: 'sess-3',
      mode: 'START',
      msisdn: '+233244123456',
      userdata: '',
      username: 'channel-a',
      trafficid: 't-3',
    });

    expect(response.mode).toBe('END');
    expect(response.userdata.toLowerCase()).toContain('credit');
  });
});
