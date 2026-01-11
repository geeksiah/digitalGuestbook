import type { EmailProvider, SmsProvider, WhatsappProvider } from '@prisma/client';
export declare function sendEmailWithProvider(provider: EmailProvider, to: string, subject: string, html: string, text?: string): Promise<{
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
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
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
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
export declare function sendBroadcast(eventId: string, broadcastId: string, message: string, subject: string | null, channels: string[], audience: 'ALL_RSVPS' | 'APPROVED_ONLY'): Promise<{
    totalRecipients: number;
    delivered: number;
    failed: number;
}>;
export declare function sendRsvpConfirmation(rsvpId: string): Promise<{
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
export declare function sendInvitationEmail(invitationId: string): Promise<{
    success: boolean;
    messageId?: undefined;
    error?: undefined;
} | {
    success: boolean;
    messageId: string | undefined;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    messageId?: undefined;
}>;
declare const _default: {
    sendEmail: typeof sendEmail;
    sendSMS: typeof sendSMS;
    sendWhatsApp: typeof sendWhatsApp;
    sendEmailWithProvider: typeof sendEmailWithProvider;
    sendSmsWithProvider: typeof sendSmsWithProvider;
    sendWhatsappWithProvider: typeof sendWhatsappWithProvider;
    checkArkeselBalance: typeof checkArkeselBalance;
    sendBroadcast: typeof sendBroadcast;
    sendRsvpConfirmation: typeof sendRsvpConfirmation;
    sendInvitationEmail: typeof sendInvitationEmail;
};
export default _default;
//# sourceMappingURL=notifications.d.ts.map