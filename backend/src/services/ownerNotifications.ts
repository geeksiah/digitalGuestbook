import prisma from '../utils/prisma.js';
import { randomUUID } from 'crypto';

type NotificationPreferenceInput = {
  notificationsEnabled?: boolean;
  marketingEnabled?: boolean;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
};

type DeviceRegistrationInput = {
  platform: string;
  oneSignalPlayerId?: string | null;
  appVersion?: string | null;
  deviceModel?: string | null;
  osVersion?: string | null;
};

type PushNotificationInput = {
  title: string;
  body: string;
  deepLink?: string | null;
  data?: Record<string, unknown> | null;
  type?: string;
  campaignId?: string | null;
  isMarketing?: boolean;
};

const toSettings = async () => {
  const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
  return {
    appId: settings?.oneSignalAppId || process.env.ONESIGNAL_APP_ID || '',
    apiKey: settings?.oneSignalApiKey || process.env.ONESIGNAL_API_KEY || '',
  };
};

const normalizePlatform = (platform: string) => {
  const normalized = String(platform || '')
    .trim()
    .toLowerCase();
  if (normalized === 'ios' || normalized === 'android' || normalized === 'web') return normalized;
  return 'android';
};

export async function getOrCreateOwnerNotificationPreference(ownerId: string) {
  return (prisma as any).ownerNotificationPreference.upsert({
    where: { ownerId },
    update: {},
    create: {
      ownerId,
      notificationsEnabled: true,
      marketingEnabled: true,
      soundEnabled: true,
      hapticsEnabled: true,
    },
  });
}

export async function updateOwnerNotificationPreference(
  ownerId: string,
  input: NotificationPreferenceInput
) {
  const existing = await getOrCreateOwnerNotificationPreference(ownerId);
  return (prisma as any).ownerNotificationPreference.update({
    where: { ownerId },
    data: {
      notificationsEnabled: input.notificationsEnabled ?? existing.notificationsEnabled,
      marketingEnabled: input.marketingEnabled ?? existing.marketingEnabled,
      soundEnabled: input.soundEnabled ?? existing.soundEnabled,
      hapticsEnabled: input.hapticsEnabled ?? existing.hapticsEnabled,
    },
  });
}

export async function registerOwnerDevice(ownerId: string, input: DeviceRegistrationInput) {
  const oneSignalPlayerId = input.oneSignalPlayerId?.trim() || null;
  const existingByPlayer = oneSignalPlayerId
    ? await (prisma as any).ownerDevice.findFirst({
        where: { ownerId, oneSignalPlayerId },
      })
    : null;

  if (existingByPlayer) {
    return (prisma as any).ownerDevice.update({
      where: { id: existingByPlayer.id },
      data: {
        platform: normalizePlatform(input.platform),
        appVersion: input.appVersion || null,
        deviceModel: input.deviceModel || null,
        osVersion: input.osVersion || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
    });
  }

  return (prisma as any).ownerDevice.create({
    data: {
      ownerId,
      platform: normalizePlatform(input.platform),
      oneSignalPlayerId,
      appVersion: input.appVersion || null,
      deviceModel: input.deviceModel || null,
      osVersion: input.osVersion || null,
      isActive: true,
      lastSeenAt: new Date(),
    },
  });
}

export async function unregisterOwnerDevice(ownerId: string, oneSignalPlayerId?: string | null) {
  if (!oneSignalPlayerId?.trim()) {
    await (prisma as any).ownerDevice.updateMany({
      where: { ownerId, isActive: true },
      data: { isActive: false },
    });
    return;
  }

  await (prisma as any).ownerDevice.updateMany({
    where: {
      ownerId,
      oneSignalPlayerId: oneSignalPlayerId.trim(),
    },
    data: { isActive: false },
  });
}

type OneSignalPayload = {
  app_id: string;
  include_player_ids: string[];
  headings: { en: string };
  contents: { en: string };
  data?: Record<string, unknown>;
  url?: string;
};

async function sendOneSignal(payload: OneSignalPayload) {
  const { appId, apiKey } = await toSettings();
  if (!appId || !apiKey) {
    return {
      ok: false,
      reason: 'OneSignal is not configured',
    };
  }

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      ...payload,
      app_id: appId,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    return {
      ok: false,
      reason: message || `OneSignal error (${response.status})`,
    };
  }

  return {
    ok: true,
  };
}

export async function createOwnerNotification(ownerId: string, input: PushNotificationInput) {
  return (prisma as any).ownerNotification.create({
    data: {
      ownerId,
      type: input.type || 'SYSTEM',
      title: input.title,
      body: input.body,
      deepLink: input.deepLink || null,
      dataJson: input.data ? JSON.stringify(input.data) : null,
    },
  });
}

export async function sendPushToOwners(ownerIds: string[], input: PushNotificationInput) {
  if (!ownerIds.length) {
    return {
      notifications: 0,
      deliveries: 0,
      pushed: 0,
      failed: 0,
    };
  }

  const owners = await prisma.owner.findMany({
    where: { id: { in: ownerIds } },
    include: {
      notificationPreference: true,
      devices: {
        where: { isActive: true },
      },
    },
  });

  const deliveryRecords: Array<{
    id: string;
    ownerId: string;
    ownerNotificationId: string;
    playerId: string;
  }> = [];
  const playerIds = new Set<string>();

  for (const owner of owners) {
    const preference = owner.notificationPreference || (await getOrCreateOwnerNotificationPreference(owner.id));
    if (!preference.notificationsEnabled) continue;
    if (input.isMarketing && !preference.marketingEnabled) continue;

    const notification = await createOwnerNotification(owner.id, input);

    owner.devices.forEach((device: any) => {
      const playerId = device.oneSignalPlayerId?.trim();
      if (!playerId) return;
      playerIds.add(playerId);
      deliveryRecords.push({
        id: randomUUID(),
        ownerId: owner.id,
        ownerNotificationId: notification.id,
        playerId,
      });
    });
  }

  if (deliveryRecords.length) {
    await (prisma as any).pushCampaignDelivery.createMany({
      data: deliveryRecords.map((record) => ({
        id: record.id,
        campaignId: input.campaignId || null,
        ownerId: record.ownerId,
        ownerNotificationId: record.ownerNotificationId,
        oneSignalPlayerId: record.playerId,
        status: 'QUEUED',
      })),
    });
  }

  let pushed = 0;
  let failed = 0;

  if (playerIds.size > 0) {
    const sendResult = await sendOneSignal({
      app_id: '',
      include_player_ids: Array.from(playerIds),
      headings: { en: input.title },
      contents: { en: input.body },
      data: input.data || undefined,
      url: input.deepLink || undefined,
    });

    if (sendResult.ok) {
      pushed = playerIds.size;
      await (prisma as any).pushCampaignDelivery.updateMany({
        where: { id: { in: deliveryRecords.map((record) => record.id) } },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } else {
      failed = playerIds.size;
      await (prisma as any).pushCampaignDelivery.updateMany({
        where: { id: { in: deliveryRecords.map((record) => record.id) } },
        data: {
          status: 'FAILED',
          failureReason: sendResult.reason,
        },
      });
    }
  }

  return {
    notifications: owners.length,
    deliveries: deliveryRecords.length,
    pushed,
    failed,
  };
}
