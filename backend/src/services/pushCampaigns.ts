import prisma from '../utils/prisma.js';
import { sendPushToOwners } from './ownerNotifications.js';

export type CampaignAudienceType =
  | 'ALL_OWNERS'
  | 'ACTIVE_OWNERS'
  | 'PENDING_APPROVAL_OWNERS'
  | 'CUSTOM_OWNER_IDS';

type ResolveAudienceInput = {
  audienceType: CampaignAudienceType;
  ownerIds?: string[];
};

export async function resolveCampaignAudience(input: ResolveAudienceInput) {
  if (input.audienceType === 'CUSTOM_OWNER_IDS') {
    const ownerIds = Array.isArray(input.ownerIds) ? input.ownerIds.filter(Boolean) : [];
    return Array.from(new Set(ownerIds));
  }

  if (input.audienceType === 'PENDING_APPROVAL_OWNERS') {
    const events = await prisma.event.findMany({
      where: {
        ownerId: { not: null },
        approvalStatus: 'PENDING_REVIEW',
      },
      select: {
        ownerId: true,
      },
    });
    return Array.from(new Set(events.map((event) => event.ownerId).filter((id): id is string => Boolean(id))));
  }

  if (input.audienceType === 'ACTIVE_OWNERS') {
    const owners = await prisma.owner.findMany({
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

  const owners = await prisma.owner.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  return owners.map((owner) => owner.id);
}

export async function dispatchCampaign(campaignId: string) {
  const campaign = await (prisma as any).pushCampaign.findUnique({
    where: { id: campaignId },
    include: {
      audiences: true,
    },
  });

  if (!campaign) {
    throw new Error('Campaign not found');
  }

  const ownerIdSet = new Set<string>();
  for (const audience of campaign.audiences as Array<any>) {
    const ownerIds = await resolveCampaignAudience({
      audienceType: audience.audienceType,
      ownerIds: audience.audienceQuery ? JSON.parse(audience.audienceQuery) : [],
    });
    ownerIds.forEach((ownerId) => ownerIdSet.add(ownerId));
  }

  await (prisma as any).pushCampaign.update({
    where: { id: campaign.id },
    data: {
      status: 'QUEUED',
    },
  });

  const dispatch = await sendPushToOwners(Array.from(ownerIdSet), {
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

  await (prisma as any).pushCampaign.update({
    where: { id: campaign.id },
    data: {
      status: dispatch.failed > 0 && dispatch.pushed === 0 ? 'FAILED' : 'SENT',
      sentAt: new Date(),
    },
  });

  return dispatch;
}
