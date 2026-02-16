"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCampaignAudience = resolveCampaignAudience;
exports.dispatchCampaign = dispatchCampaign;
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const ownerNotifications_js_1 = require("./ownerNotifications.js");
async function resolveCampaignAudience(input) {
    if (input.audienceType === 'CUSTOM_OWNER_IDS') {
        const ownerIds = Array.isArray(input.ownerIds) ? input.ownerIds.filter(Boolean) : [];
        return Array.from(new Set(ownerIds));
    }
    if (input.audienceType === 'PENDING_APPROVAL_OWNERS') {
        const events = await prisma_js_1.default.event.findMany({
            where: {
                ownerId: { not: null },
                approvalStatus: 'PENDING_REVIEW',
            },
            select: {
                ownerId: true,
            },
        });
        return Array.from(new Set(events.map((event) => event.ownerId).filter((id) => Boolean(id))));
    }
    if (input.audienceType === 'ACTIVE_OWNERS') {
        const owners = await prisma_js_1.default.owner.findMany({
            where: {
                isActive: true,
                events: {
                    some: {},
                },
            },
            select: { id: true },
        });
        return owners.map((owner) => owner.id);
    }
    const owners = await prisma_js_1.default.owner.findMany({
        where: { isActive: true },
        select: { id: true },
    });
    return owners.map((owner) => owner.id);
}
async function dispatchCampaign(campaignId) {
    const campaign = await prisma_js_1.default.pushCampaign.findUnique({
        where: { id: campaignId },
        include: {
            audiences: true,
        },
    });
    if (!campaign) {
        throw new Error('Campaign not found');
    }
    const ownerIdSet = new Set();
    for (const audience of campaign.audiences) {
        const ownerIds = await resolveCampaignAudience({
            audienceType: audience.audienceType,
            ownerIds: audience.audienceQuery ? JSON.parse(audience.audienceQuery) : [],
        });
        ownerIds.forEach((ownerId) => ownerIdSet.add(ownerId));
    }
    await prisma_js_1.default.pushCampaign.update({
        where: { id: campaign.id },
        data: {
            status: 'QUEUED',
        },
    });
    const dispatch = await (0, ownerNotifications_js_1.sendPushToOwners)(Array.from(ownerIdSet), {
        title: campaign.title,
        body: campaign.body,
        deepLink: campaign.deepLink,
        campaignId: campaign.id,
        type: 'MARKETING',
        isMarketing: true,
        data: {
            campaignId: campaign.id,
            kind: 'marketing_campaign',
        },
    });
    await prisma_js_1.default.pushCampaign.update({
        where: { id: campaign.id },
        data: {
            status: dispatch.failed > 0 && dispatch.pushed === 0 ? 'FAILED' : 'SENT',
            sentAt: new Date(),
        },
    });
    return dispatch;
}
//# sourceMappingURL=pushCampaigns.js.map