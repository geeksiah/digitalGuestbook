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
export declare function getOrCreateOwnerNotificationPreference(ownerId: string): Promise<any>;
export declare function updateOwnerNotificationPreference(ownerId: string, input: NotificationPreferenceInput): Promise<any>;
export declare function registerOwnerDevice(ownerId: string, input: DeviceRegistrationInput): Promise<any>;
export declare function unregisterOwnerDevice(ownerId: string, oneSignalPlayerId?: string | null): Promise<void>;
export declare function createOwnerNotification(ownerId: string, input: PushNotificationInput): Promise<any>;
export declare function sendPushToOwners(ownerIds: string[], input: PushNotificationInput): Promise<{
    notifications: number;
    deliveries: number;
    pushed: number;
    failed: number;
}>;
export {};
//# sourceMappingURL=ownerNotifications.d.ts.map