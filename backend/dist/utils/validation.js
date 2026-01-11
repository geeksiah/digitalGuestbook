"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBroadcastSchema = exports.mediaUploadSchema = exports.checkInSchema = exports.reviewRsvpSchema = exports.createRsvpSchema = exports.updateTemplateSchema = exports.createTemplateSchema = exports.updateEventSchema = exports.createEventSchema = exports.registerAdminSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// ============================================
// AUTH SCHEMAS
// ============================================
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
exports.registerAdminSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    role: zod_1.z.enum(['admin', 'superadmin']).default('admin'),
});
// ============================================
// EVENT SCHEMAS
// ============================================
exports.createEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Event name must be at least 2 characters'),
    slug: zod_1.z.string()
        .min(2, 'Slug must be at least 2 characters')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: zod_1.z.string().optional().nullable(),
    date: zod_1.z.string().datetime('Invalid date format'),
    endDate: zod_1.z.string().datetime('Invalid date format').optional().nullable(),
    timezone: zod_1.z.string().default('UTC'),
    venue: zod_1.z.string().optional().nullable(),
    // Service Flags
    invitationEnabled: zod_1.z.boolean().default(true),
    rsvpEnabled: zod_1.z.boolean().default(true),
    guestbookEnabled: zod_1.z.boolean().default(true),
    checkInEnabled: zod_1.z.boolean().default(true),
    // Invitation-Only Flag
    invitationOnly: zod_1.z.boolean().default(false),
    // Guestbook Settings
    maxRecordingDuration: zod_1.z.number().min(30).max(300).default(120),
    minRecordingDuration: zod_1.z.number().min(5).max(60).default(30),
    maxPhotosPerGuest: zod_1.z.number().min(1).max(50).default(5),
});
exports.updateEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
    description: zod_1.z.string().optional().nullable(),
    date: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional().nullable(),
    timezone: zod_1.z.string().optional(),
    venue: zod_1.z.string().optional().nullable(),
    // Event Owner Contact Info
    ownerId: zod_1.z.string().uuid().optional().nullable(),
    ownerName: zod_1.z.string().optional().nullable(),
    ownerEmail: zod_1.z.string().email().optional().nullable().or(zod_1.z.literal('')),
    ownerPhone: zod_1.z.string().optional().nullable(),
    organizationName: zod_1.z.string().optional().nullable(),
    // Event Styling
    primaryColor: zod_1.z.string().optional(),
    secondaryColor: zod_1.z.string().optional(),
    accentColor: zod_1.z.string().optional(),
    // Service Flags
    invitationEnabled: zod_1.z.boolean().optional(),
    rsvpEnabled: zod_1.z.boolean().optional(),
    guestbookEnabled: zod_1.z.boolean().optional(),
    checkInEnabled: zod_1.z.boolean().optional(),
    invitationOnly: zod_1.z.boolean().optional(),
    // Template Assignments
    invitationTemplateId: zod_1.z.string().optional().nullable(),
    rsvpTemplateId: zod_1.z.string().optional().nullable(),
    guestbookTemplateId: zod_1.z.string().optional().nullable(),
    guestbookVideoTemplateId: zod_1.z.string().optional().nullable(),
    guestbookAudioTemplateId: zod_1.z.string().optional().nullable(),
    guestbookPhotoTemplateId: zod_1.z.string().optional().nullable(),
    boothTemplateId: zod_1.z.string().optional().nullable(),
    boothVideoTemplateId: zod_1.z.string().optional().nullable(),
    boothAudioTemplateId: zod_1.z.string().optional().nullable(),
    boothPhotoTemplateId: zod_1.z.string().optional().nullable(),
    thankYouTemplateId: zod_1.z.string().optional().nullable(),
    // Guestbook Settings
    maxRecordingDuration: zod_1.z.number().min(30).max(300).optional(),
    minRecordingDuration: zod_1.z.number().min(5).max(60).optional(),
    maxPhotosPerGuest: zod_1.z.number().min(1).max(50).optional(),
    // Booth Settings
    maxPhotosPerBoothSession: zod_1.z.number().min(1).max(50).optional(),
    boothShutterCountdown: zod_1.z.number().min(1).max(10).optional(),
    // RSVP/Ticketing Mode
    rsvpMode: zod_1.z.enum(['free', 'paid']).optional(),
    ticketingEnabled: zod_1.z.boolean().optional(),
    platformFeePercent: zod_1.z.number().min(0).max(100).optional(),
    processingFeePercent: zod_1.z.number().min(0).max(100).optional(),
    processingFeeFixed: zod_1.z.number().min(0).optional(),
    requireApproval: zod_1.z.boolean().optional(),
    // Notification Settings
    notifyOnRsvp: zod_1.z.boolean().optional(),
    notifyOnCheckIn: zod_1.z.boolean().optional(),
    notifyOnGuestbook: zod_1.z.boolean().optional(),
    emailNotifications: zod_1.z.boolean().optional(),
    smsNotifications: zod_1.z.boolean().optional(),
    whatsappNotifications: zod_1.z.boolean().optional(),
    // Phase & Status
    phase: zod_1.z.enum(['PRE_EVENT', 'LIVE', 'POST_EVENT']).optional(),
    phaseOverride: zod_1.z.boolean().optional(),
    isArchived: zod_1.z.boolean().optional(),
    reelEnabled: zod_1.z.boolean().optional(),
});
// ============================================
// TEMPLATE SCHEMAS
// ============================================
exports.createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Template name must be at least 2 characters'),
    description: zod_1.z.string().optional(),
    type: zod_1.z.enum([
        'INVITATION',
        'RSVP',
        'GUESTBOOK',
        'GUESTBOOK_VIDEO',
        'GUESTBOOK_AUDIO',
        'GUESTBOOK_PHOTO',
        'BOOTH',
        'BOOTH_VIDEO',
        'BOOTH_AUDIO',
        'BOOTH_PHOTO',
        'THANK_YOU'
    ]),
    htmlContent: zod_1.z.string().min(1, 'HTML content is required'),
    cssContent: zod_1.z.string().optional(),
    jsContent: zod_1.z.string().optional(),
    assetsPath: zod_1.z.string().optional(),
    thumbnailPath: zod_1.z.string().optional(),
    variables: zod_1.z.string().optional(), // JSON string
    isDefault: zod_1.z.boolean().default(false),
});
exports.updateTemplateSchema = exports.createTemplateSchema.partial();
// ============================================
// RSVP SCHEMAS (SRS Section 4.2)
// ============================================
exports.createRsvpSchema = zod_1.z.object({
    primaryName: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    secondaryName: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    attendance: zod_1.z.enum(['YES', 'NO', 'MAYBE']),
    guestCount: zod_1.z.number().int().min(1).max(20).default(1),
    mealPreference: zod_1.z.string().optional(),
    dietaryNotes: zod_1.z.string().optional(),
    note: zod_1.z.string().max(500, 'Note must be under 500 characters').optional(),
    // Custom fields (JSON object)
    customFields: zod_1.z.record(zod_1.z.any()).optional(),
    // Ticketing fields
    ticketType: zod_1.z.string().optional(),
    ticketQuantity: zod_1.z.number().int().min(1).optional(),
    submissionChannel: zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'WEB']).default('WEB'),
});
exports.reviewRsvpSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
});
// ============================================
// CHECK-IN SCHEMAS (SRS Section 8)
// ============================================
exports.checkInSchema = zod_1.z.object({
    // Either QR code token or 6-digit access code
    token: zod_1.z.string().optional(),
    accessCode: zod_1.z.string().length(6, 'Access code must be 6 digits').optional(),
    method: zod_1.z.enum(['QR_SCAN', 'MANUAL_CODE']),
    deviceInfo: zod_1.z.string().optional(),
}).refine((data) => data.token || data.accessCode, { message: 'Either token or accessCode is required' });
// ============================================
// GUESTBOOK SCHEMAS (SRS Section 9)
// ============================================
exports.mediaUploadSchema = zod_1.z.object({
    type: zod_1.z.enum(['VIDEO', 'AUDIO', 'PHOTO']),
    guestName: zod_1.z.string().optional(),
    guestEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    captureMode: zod_1.z.enum(['PERSONAL', 'BOOTH']).default('PERSONAL'),
    deviceId: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional(), // For video/audio
});
// ============================================
// BROADCAST SCHEMAS (SRS Section 11)
// ============================================
exports.createBroadcastSchema = zod_1.z.object({
    subject: zod_1.z.string().optional(),
    message: zod_1.z.string().min(1, 'Message is required').max(1000),
    audience: zod_1.z.enum(['ALL_RSVPS', 'APPROVED_ONLY']),
    channels: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1),
});
//# sourceMappingURL=validation.js.map