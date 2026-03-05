"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const prisma_js_1 = __importDefault(require("../../../utils/prisma.js"));
const FrogUssdV2Adapter_js_1 = require("./FrogUssdV2Adapter.js");
const setPrismaMocks = () => {
    prisma_js_1.default.ussdChannelBinding = {
        findFirst: vitest_1.vi.fn().mockResolvedValue(null),
    };
    prisma_js_1.default.ussdSession = {
        upsert: vitest_1.vi.fn(),
        update: vitest_1.vi.fn(),
    };
    prisma_js_1.default.ussdTrafficLog = {
        findFirst: vitest_1.vi.fn(),
        create: vitest_1.vi.fn(),
    };
    prisma_js_1.default.votingEventConfig = {
        findUnique: vitest_1.vi.fn(),
    };
};
(0, vitest_1.describe)('FrogUssdV2Adapter', () => {
    (0, vitest_1.beforeEach)(() => {
        setPrismaMocks();
    });
    (0, vitest_1.it)('accepts phonenumber payload field', async () => {
        const adapter = new FrogUssdV2Adapter_js_1.FrogUssdV2Adapter({ listContests: vitest_1.vi.fn(), listOptions: vitest_1.vi.fn(), castElectionVote: vitest_1.vi.fn(), castFreeAwardVote: vitest_1.vi.fn() }, { ensureWalletForEvent: vitest_1.vi.fn(), consumeCredits: vitest_1.vi.fn() }, { normalizeMsisdn: vitest_1.vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vitest_1.vi.fn() });
        const response = await adapter.handleRequest({
            network: 'MTN',
            sessionid: 'sess-1',
            mode: 'START',
            phonenumber: '0244123456',
            userdata: '',
            username: 'channel-a',
            trafficid: 't-1',
        });
        (0, vitest_1.expect)(response.mode).toBe('END');
        (0, vitest_1.expect)(response.phonenumber).toBe('0244123456');
    });
    (0, vitest_1.it)('accepts msisdn payload field', async () => {
        const adapter = new FrogUssdV2Adapter_js_1.FrogUssdV2Adapter({ listContests: vitest_1.vi.fn(), listOptions: vitest_1.vi.fn(), castElectionVote: vitest_1.vi.fn(), castFreeAwardVote: vitest_1.vi.fn() }, { ensureWalletForEvent: vitest_1.vi.fn(), consumeCredits: vitest_1.vi.fn() }, { normalizeMsisdn: vitest_1.vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vitest_1.vi.fn() });
        const response = await adapter.handleRequest({
            network: 'MTN',
            sessionid: 'sess-2',
            mode: 'MORE',
            msisdn: '+233244123456',
            userdata: '1',
            username: 'channel-a',
            trafficid: 't-2',
        });
        (0, vitest_1.expect)(response.mode).toBe('END');
        (0, vitest_1.expect)(response.msisdn).toBe('+233244123456');
    });
    (0, vitest_1.it)('tolerates END mode input', async () => {
        const adapter = new FrogUssdV2Adapter_js_1.FrogUssdV2Adapter({ listContests: vitest_1.vi.fn(), listOptions: vitest_1.vi.fn(), castElectionVote: vitest_1.vi.fn(), castFreeAwardVote: vitest_1.vi.fn() }, { ensureWalletForEvent: vitest_1.vi.fn(), consumeCredits: vitest_1.vi.fn() }, { normalizeMsisdn: vitest_1.vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vitest_1.vi.fn() });
        const response = await adapter.handleRequest({
            network: 'MTN',
            sessionid: 'sess-2-end',
            mode: 'END',
            msisdn: '+233244123456',
            userdata: '',
            username: 'channel-a',
            trafficid: 't-2-end',
        });
        (0, vitest_1.expect)(response.mode).toBe('END');
    });
    (0, vitest_1.it)('ends session politely when credits are insufficient', async () => {
        prisma_js_1.default.ussdChannelBinding.findFirst.mockResolvedValue({
            id: 'binding-1',
            eventId: 'event-1',
            ussdChannelId: 'channel-1',
            ussdChannel: { id: 'channel-1' },
        });
        prisma_js_1.default.ussdSession.upsert.mockResolvedValue({
            id: 'session-db-1',
            state: 'WELCOME',
            contextJson: null,
        });
        prisma_js_1.default.ussdTrafficLog.findFirst.mockResolvedValue(null);
        const adapter = new FrogUssdV2Adapter_js_1.FrogUssdV2Adapter({ listContests: vitest_1.vi.fn(), listOptions: vitest_1.vi.fn(), castElectionVote: vitest_1.vi.fn(), castFreeAwardVote: vitest_1.vi.fn() }, {
            ensureWalletForEvent: vitest_1.vi.fn().mockResolvedValue({ id: 'wallet-1' }),
            consumeCredits: vitest_1.vi.fn().mockResolvedValue({ status: 'insufficient' }),
        }, { normalizeMsisdn: vitest_1.vi.fn().mockReturnValue('+233244123456'), deriveVoterKey: vitest_1.vi.fn() });
        const response = await adapter.handleRequest({
            network: 'MTN',
            sessionid: 'sess-3',
            mode: 'START',
            msisdn: '+233244123456',
            userdata: '',
            username: 'channel-a',
            trafficid: 't-3',
        });
        (0, vitest_1.expect)(response.mode).toBe('END');
        (0, vitest_1.expect)(response.userdata.toLowerCase()).toContain('credit');
    });
});
//# sourceMappingURL=FrogUssdV2Adapter.test.js.map