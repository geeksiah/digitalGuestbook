"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FrogUssdV2Adapter = void 0;
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../../../utils/prisma.js"));
const errorHandler_js_1 = require("../../../middleware/errorHandler.js");
const UssdRenderer_js_1 = require("../ussd/UssdRenderer.js");
const UssdStateMachine_js_1 = require("../ussd/UssdStateMachine.js");
const basePayloadSchema = zod_1.z.object({
    network: zod_1.z.string().min(1),
    sessionid: zod_1.z.string().min(1),
    mode: zod_1.z.string().min(1),
    userdata: zod_1.z.string(),
    username: zod_1.z.string().min(1),
    trafficid: zod_1.z.string().min(1),
    other: zod_1.z.string().optional(),
    msisdn: zod_1.z.string().optional(),
    phonenumber: zod_1.z.string().optional(),
});
const normalizeMode = (mode) => {
    const upper = String(mode || '').trim().toUpperCase();
    if (upper === 'START')
        return 'START';
    if (upper === 'END')
        return 'END';
    return 'MORE';
};
class FrogUssdV2Adapter {
    votingService;
    creditsService;
    identityService;
    renderer = new UssdRenderer_js_1.UssdRenderer();
    machine = new UssdStateMachine_js_1.UssdStateMachine();
    constructor(votingService, creditsService, identityService) {
        this.votingService = votingService;
        this.creditsService = creditsService;
        this.identityService = identityService;
    }
    async handleRequest(rawInput) {
        const payload = basePayloadSchema.parse(rawInput);
        const mode = normalizeMode(payload.mode);
        const phoneField = payload.msisdn ? 'msisdn' : payload.phonenumber ? 'phonenumber' : null;
        const rawPhone = payload.msisdn || payload.phonenumber;
        if (!phoneField || !rawPhone) {
            throw new errorHandler_js_1.AppError('msisdn or phonenumber is required', 400);
        }
        const msisdnNormalized = this.identityService.normalizeMsisdn(rawPhone);
        const channelBinding = await prisma_js_1.default.ussdChannelBinding.findFirst({
            where: {
                isActive: true,
                ussdChannel: {
                    provider: 'WIGAL_FROG',
                    status: 'ACTIVE',
                    codeLabel: payload.username,
                },
            },
            include: {
                ussdChannel: true,
            },
            orderBy: { createdAt: 'asc' },
        });
        if (!channelBinding) {
            return this.reply(payload, phoneField, {
                mode: 'END',
                userdata: this.renderer.renderLines(['USSD channel not linked to an active event.']),
            });
        }
        const session = await prisma_js_1.default.ussdSession.upsert({
            where: { providerSessionId: payload.sessionid },
            create: {
                providerSessionId: payload.sessionid,
                lastTrafficId: payload.trafficid,
                msisdnNormalized,
                ussdChannelId: channelBinding.ussdChannelId,
                eventId: channelBinding.eventId,
                state: 'WELCOME',
                contextJson: null,
                responseJson: null,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
            update: {
                msisdnNormalized,
                ussdChannelId: channelBinding.ussdChannelId,
                eventId: channelBinding.eventId,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });
        const duplicateTraffic = await prisma_js_1.default.ussdTrafficLog.findFirst({
            where: {
                ussdSessionId: session.id,
                trafficId: payload.trafficid,
            },
        });
        if (duplicateTraffic) {
            const response = JSON.parse(duplicateTraffic.responseJson);
            return response;
        }
        const wallet = await this.creditsService.ensureWalletForEvent(channelBinding.eventId);
        const consumeResult = await this.creditsService.consumeCredits(wallet.id, 1, `${payload.sessionid}:${payload.trafficid}`, { network: payload.network, mode });
        if (consumeResult.status === 'insufficient') {
            const response = this.reply(payload, phoneField, {
                mode: 'END',
                userdata: this.renderer.renderLines(['USSD credit is finished. Please top up and retry.']),
            });
            await this.storeTraffic(session.id, payload.trafficid, payload, response);
            return response;
        }
        const contests = await this.votingService.listContests(channelBinding.eventId);
        const contestOptions = await Promise.all(contests.map(async (contest) => ({
            id: contest.id,
            title: contest.title,
            options: (await this.votingService.listOptions(channelBinding.eventId, contest.id)).map((option) => ({
                id: option.id,
                name: option.name,
                totalVotes: option.totalVotes,
            })),
        })));
        const parsedContext = this.parseSessionContext(session.contextJson);
        const state = (session.state || 'WELCOME');
        const machineResult = this.machine.step({
            mode,
            userInput: mode === 'START' ? '' : payload.userdata,
            state,
            context: parsedContext,
            contests: contestOptions,
        });
        if (machineResult.nextState === 'SUCCESS' && machineResult.shouldEnd) {
            const selectedContestId = machineResult.contextUpdates.selectedContestId || parsedContext.selectedContestId;
            const selectedOptionId = machineResult.contextUpdates.selectedOptionId || parsedContext.selectedOptionId;
            if (selectedContestId && selectedOptionId) {
                const voterKey = this.identityService.deriveVoterKey({
                    eventId: channelBinding.eventId,
                    scopeKey: selectedContestId,
                    msisdnNormalized,
                });
                const config = await prisma_js_1.default.votingEventConfig.findUnique({
                    where: { eventId: channelBinding.eventId },
                    select: {
                        mode: true,
                        freeVoteScope: true,
                    },
                });
                if (config?.mode === 'ELECTION') {
                    await this.votingService.castElectionVote({
                        eventId: channelBinding.eventId,
                        contestId: selectedContestId,
                        optionId: selectedOptionId,
                        voterKey,
                        channel: 'USSD',
                    });
                }
                else {
                    await this.votingService.castFreeAwardVote({
                        eventId: channelBinding.eventId,
                        contestId: selectedContestId,
                        optionId: selectedOptionId,
                        voterKey,
                        scope: config?.freeVoteScope || 'CONTEST',
                        channel: 'USSD',
                    });
                }
            }
        }
        const response = this.reply(payload, phoneField, {
            mode: machineResult.shouldEnd ? 'END' : 'MORE',
            userdata: this.renderer.renderLines(machineResult.responseLines),
        });
        await prisma_js_1.default.ussdSession.update({
            where: { id: session.id },
            data: {
                state: machineResult.nextState,
                contextJson: JSON.stringify(machineResult.contextUpdates || {}),
                responseJson: JSON.stringify(response),
                lastTrafficId: payload.trafficid,
                expiresAt: new Date(Date.now() + 5 * 60 * 1000),
            },
        });
        await this.storeTraffic(session.id, payload.trafficid, payload, response);
        return response;
    }
    parseSessionContext(rawContext) {
        if (!rawContext)
            return {};
        try {
            const parsed = JSON.parse(rawContext);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch {
            return {};
        }
    }
    async storeTraffic(sessionId, trafficId, requestPayload, response) {
        try {
            await prisma_js_1.default.ussdTrafficLog.create({
                data: {
                    ussdSessionId: sessionId,
                    trafficId,
                    requestJson: JSON.stringify(requestPayload),
                    responseJson: JSON.stringify(response),
                },
            });
        }
        catch (error) {
            const maybe = error;
            if (maybe.code !== 'P2002')
                throw error;
        }
    }
    reply(payload, phoneField, input) {
        const response = {
            network: payload.network,
            sessionid: payload.sessionid,
            mode: input.mode,
            userdata: input.userdata,
            username: payload.username,
            trafficid: payload.trafficid,
            ...(payload.other ? { other: payload.other } : {}),
            ...(phoneField === 'msisdn'
                ? { msisdn: payload.msisdn || payload.phonenumber || '' }
                : { phonenumber: payload.phonenumber || payload.msisdn || '' }),
        };
        return response;
    }
}
exports.FrogUssdV2Adapter = FrogUssdV2Adapter;
//# sourceMappingURL=FrogUssdV2Adapter.js.map