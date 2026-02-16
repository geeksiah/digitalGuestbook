"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateOwnerNotificationPreference = getOrCreateOwnerNotificationPreference;
exports.updateOwnerNotificationPreference = updateOwnerNotificationPreference;
exports.registerOwnerDevice = registerOwnerDevice;
exports.unregisterOwnerDevice = unregisterOwnerDevice;
exports.createOwnerNotification = createOwnerNotification;
exports.sendPushToOwners = sendPushToOwners;
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const crypto_1 = require("crypto");
const toSettings = async () => {
    const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
    return {
        appId: settings?.oneSignalAppId || process.env.ONESIGNAL_APP_ID || '',
        apiKey: settings?.oneSignalApiKey || process.env.ONESIGNAL_API_KEY || '',
    };
};
const normalizePlatform = (platform) => {
    const normalized = String(platform || '')
        .trim()
        .toLowerCase();
    if (normalized === 'ios' || normalized === 'android' || normalized === 'web')
        return normalized;
    return 'android';
};
async function getOrCreateOwnerNotificationPreference(ownerId) {
    return prisma_js_1.default.ownerNotificationPreference.upsert({
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
async function updateOwnerNotificationPreference(ownerId, input) {
    const existing = await getOrCreateOwnerNotificationPreference(ownerId);
    return prisma_js_1.default.ownerNotificationPreference.update({
        where: { ownerId },
        data: {
            notificationsEnabled: input.notificationsEnabled ?? existing.notificationsEnabled,
            marketingEnabled: input.marketingEnabled ?? existing.marketingEnabled,
            soundEnabled: input.soundEnabled ?? existing.soundEnabled,
            hapticsEnabled: input.hapticsEnabled ?? existing.hapticsEnabled,
        },
    });
}
async function registerOwnerDevice(ownerId, input) {
    const oneSignalPlayerId = input.oneSignalPlayerId?.trim() || null;
    const existingByPlayer = oneSignalPlayerId
        ? await prisma_js_1.default.ownerDevice.findFirst({
            where: { ownerId, oneSignalPlayerId },
        })
        : null;
    if (existingByPlayer) {
        return prisma_js_1.default.ownerDevice.update({
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
    return prisma_js_1.default.ownerDevice.create({
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
async function unregisterOwnerDevice(ownerId, oneSignalPlayerId) {
    if (!oneSignalPlayerId?.trim()) {
        await prisma_js_1.default.ownerDevice.updateMany({
            where: { ownerId, isActive: true },
            data: { isActive: false },
        });
        return;
    }
    await prisma_js_1.default.ownerDevice.updateMany({
        where: {
            ownerId,
            oneSignalPlayerId: oneSignalPlayerId.trim(),
        },
        data: { isActive: false },
    });
}
async function sendOneSignal(payload) {
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
async function createOwnerNotification(ownerId, input) {
    return prisma_js_1.default.ownerNotification.create({
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
async function sendPushToOwners(ownerIds, input) {
    if (!ownerIds.length) {
        return {
            notifications: 0,
            deliveries: 0,
            pushed: 0,
            failed: 0,
        };
    }
    const owners = await prisma_js_1.default.owner.findMany({
        where: { id: { in: ownerIds } },
        include: {
            notificationPreference: true,
            devices: {
                where: { isActive: true },
            },
        },
    });
    const deliveryRecords = [];
    const playerIds = new Set();
    for (const owner of owners) {
        const preference = owner.notificationPreference || (await getOrCreateOwnerNotificationPreference(owner.id));
        if (!preference.notificationsEnabled)
            continue;
        if (input.isMarketing && !preference.marketingEnabled)
            continue;
        const notification = await createOwnerNotification(owner.id, input);
        owner.devices.forEach((device) => {
            const playerId = device.oneSignalPlayerId?.trim();
            if (!playerId)
                return;
            playerIds.add(playerId);
            deliveryRecords.push({
                id: (0, crypto_1.randomUUID)(),
                ownerId: owner.id,
                ownerNotificationId: notification.id,
                playerId,
            });
        });
    }
    if (deliveryRecords.length) {
        await prisma_js_1.default.pushCampaignDelivery.createMany({
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
            await prisma_js_1.default.pushCampaignDelivery.updateMany({
                where: { id: { in: deliveryRecords.map((record) => record.id) } },
                data: {
                    status: 'SENT',
                    sentAt: new Date(),
                },
            });
        }
        else {
            failed = playerIds.size;
            await prisma_js_1.default.pushCampaignDelivery.updateMany({
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
//# sourceMappingURL=ownerNotifications.js.map