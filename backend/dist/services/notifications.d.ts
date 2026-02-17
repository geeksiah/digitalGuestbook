import type { EmailProvider, SmsProvider, WhatsappProvider } from '@prisma/client';
export declare function sendEmailWithProvider(provider: EmailProvider, to: string, subject: string, html: string, text?: string, attachments?: Array<{
    filename: string;
    content: Buffer;
    cid?: string;
}>): Promise<{
    success: boolean;
    messageId: any;
    error?: undefined;
} | {
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
export declare function sendSmsWithProvider(provider: SmsProvider, to: string, message: string): Promise<{
    success: boolean;
    sid?: string;
    messageId?: string;
    balance?: number;
    error?: string;
}>;
/**
 * Check Arkesel SMS balance
 */
export declare function checkArkeselBalance(apiKey: string): Promise<{
    success: boolean;
    balance?: number;
    error?: string;
}>;
export declare function sendWhatsappWithProvider(provider: WhatsappProvider, to: string, message: string): Promise<{
    success: boolean;
    sid: string;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
    sid?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    sid?: undefined;
    messageId?: undefined;
}>;
export declare function sendEmail(to: string, subject: string, html: string, text?: string): Promise<{
    success: boolean;
    messageId: any;
    error?: undefined;
} | {
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
export declare function sendSMS(to: string, message: string): Promise<{
    success: boolean;
    sid?: string;
    messageId?: string;
    balance?: number;
    error?: string;
}>;
export declare function sendWhatsApp(to: string, message: string): Promise<{
    success: boolean;
    sid: string;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
    sid?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    sid?: undefined;
    messageId?: undefined;
}>;
type WhatsAppRsvpInviteInput = {
    eventName: string;
    inviteUrl: string;
    token: string;
    reminder?: boolean;
};
export declare function sendWhatsAppRsvpInvite(to: string, input: WhatsAppRsvpInviteInput): Promise<{
    success: boolean;
    mode: "interactive";
    messageId: string | undefined;
} | {
    success: boolean;
    mode: "disabled";
    error: string;
} | {
    mode: "text";
    success: boolean;
    sid: string;
    messageId?: undefined;
    error?: undefined;
} | {
    mode: "text";
    success: boolean;
    messageId: string | undefined;
    sid?: undefined;
    error?: undefined;
} | {
    mode: "text";
    success: boolean;
    error: any;
    sid?: undefined;
    messageId?: undefined;
}>;
export declare function sendEmailRsvpInvite(to: string, input: WhatsAppRsvpInviteInput & {
    inviteeName?: string;
}): Promise<{
    success: boolean;
    mode: "email";
    error: any;
}>;
export declare function sendBroadcast(eventId: string, broadcastId: string, message: string, subject: string | null, channels: string[], audience: 'ALL_RSVPS' | 'APPROVED_ONLY'): Promise<{
    totalRecipients: number;
    delivered: number;
    failed: number;
}>;
export declare function sendRsvpConfirmation(rsvpId: string): Promise<{
    success: boolean;
    messageId: any;
    error?: undefined;
} | {
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
export declare function sendInvitationEmail(invitationId: string): Promise<{
    success: boolean;
    messageId: any;
    error?: undefined;
} | {
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
/**
 * Send invitation via WhatsApp with QR code
 */
export declare function sendInvitationWhatsApp(invitationId: string): Promise<{
    success: boolean;
    sid: string;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
    sid?: undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    sid?: undefined;
    messageId?: undefined;
}>;
/**
 * Send invitation via SMS with 6-digit code only
 */
export declare function sendInvitationSMS(invitationId: string): Promise<{
    success: boolean;
    sid?: string;
    messageId?: string;
    balance?: number;
    error?: string;
}>;
/**
 * Send invitation notifications via all enabled channels
 */
export declare function sendInvitationNotifications(invitationId: string): Promise<any>;
declare const _default: {
    sendEmail: typeof sendEmail;
    sendSMS: typeof sendSMS;
    sendWhatsApp: typeof sendWhatsApp;
    sendWhatsAppRsvpInvite: typeof sendWhatsAppRsvpInvite;
    sendEmailRsvpInvite: typeof sendEmailRsvpInvite;
    sendEmailWithProvider: typeof sendEmailWithProvider;
    sendSmsWithProvider: typeof sendSmsWithProvider;
    sendWhatsappWithProvider: typeof sendWhatsappWithProvider;
    checkArkeselBalance: typeof checkArkeselBalance;
    sendBroadcast: typeof sendBroadcast;
    sendRsvpConfirmation: typeof sendRsvpConfirmation;
    sendInvitationEmail: typeof sendInvitationEmail;
    sendInvitationWhatsApp: typeof sendInvitationWhatsApp;
    sendInvitationSMS: typeof sendInvitationSMS;
    sendInvitationNotifications: typeof sendInvitationNotifications;
};
export default _default;
//# sourceMappingURL=notifications.d.ts.map