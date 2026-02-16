"use strict";
// COMPLETE DROP-IN REPLACEMENT
// File: backend/src/utils/validation.ts
// Includes: LIVE_LANDING and EVENT_ENDED template types
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOwnerSchema = exports.createOwnerSchema = exports.createBroadcastSchema = exports.mediaUploadSchema = exports.checkInSchema = exports.reviewRsvpSchema = exports.createRsvpSchema = exports.updateTemplateSchema = exports.createTemplateSchema = exports.updateEventSchema = exports.createEventSchema = exports.registerAdminSchema = exports.loginSchema = void 0;
const zod_1 = require("zod");
// ============================================
// AUTH SCHEMAS
// ============================================
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.registerAdminSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters'),
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    role: zod_1.z.enum(['admin', 'superadmin']).default('admin'),
});
// ============================================
// EVENT SCHEMAS
// ============================================
exports.createEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Event name must be at least 2 characters'),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    description: zod_1.z.string().optional().nullable(),
    socialTitle: zod_1.z.string().max(120).optional().nullable(),
    socialDescription: zod_1.z.string().max(240).optional().nullable(),
    coverImagePath: zod_1.z.string().optional().nullable(),
    coverImageAlt: zod_1.z.string().max(160).optional().nullable(),
    date: zod_1.z.string().datetime('Invalid date format'),
    endDate: zod_1.z.string().datetime().optional().nullable(),
    timezone: zod_1.z.string().default('UTC'),
    venue: zod_1.z.string().optional().nullable(),
    defaultCurrency: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
        .default('USD'),
    // Owner
    ownerId: zod_1.z.string().uuid().optional(),
    // Owner Contact
    ownerName: zod_1.z.string().optional().nullable(),
    ownerEmail: zod_1.z.string().email().optional().nullable(),
    ownerPhone: zod_1.z.string().optional().nullable(),
    organizationName: zod_1.z.string().optional().nullable(),
    // Event Styling
    primaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFD700'),
    secondaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1a1a2e'),
    accentColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff'),
    // Service Flags
    invitationEnabled: zod_1.z.boolean().default(true),
    rsvpEnabled: zod_1.z.boolean().default(true),
    guestbookEnabled: zod_1.z.boolean().default(true),
    checkInEnabled: zod_1.z.boolean().default(true),
    invitationOnly: zod_1.z.boolean().default(false),
    strictInviteOnly: zod_1.z.boolean().default(false),
    itineraryEnabled: zod_1.z.boolean().default(false),
    itineraryTemplateId: zod_1.z.string().uuid().optional().nullable(),
    giftingEnabled: zod_1.z.boolean().default(false),
    itineraryPageTemplateId: zod_1.z.string().uuid().optional().nullable(),
    giftingPageTemplateId: zod_1.z.string().uuid().optional().nullable(),
    // Template Assignments - ⭐ INCLUDES NEW TEMPLATE TYPES
    invitationTemplateId: zod_1.z.string().uuid().optional(),
    rsvpTemplateId: zod_1.z.string().uuid().optional(),
    guestbookTemplateId: zod_1.z.string().uuid().optional(),
    guestbookVideoTemplateId: zod_1.z.string().uuid().optional(),
    guestbookAudioTemplateId: zod_1.z.string().uuid().optional(),
    guestbookPhotoTemplateId: zod_1.z.string().uuid().optional(),
    boothTemplateId: zod_1.z.string().uuid().optional(),
    boothVideoTemplateId: zod_1.z.string().uuid().optional(),
    boothAudioTemplateId: zod_1.z.string().uuid().optional(),
    boothPhotoTemplateId: zod_1.z.string().uuid().optional(),
    thankYouTemplateId: zod_1.z.string().uuid().optional(),
    liveLandingTemplateId: zod_1.z.string().uuid().optional(), // ⭐ NEW
    eventEndedTemplateId: zod_1.z.string().uuid().optional(), // ⭐ NEW
    // Guestbook Settings
    maxRecordingDuration: zod_1.z.number().int().min(30).max(300).default(120),
    minRecordingDuration: zod_1.z.number().int().min(5).max(60).default(30),
    maxPhotosPerGuest: zod_1.z.number().int().min(1).max(50).default(5),
    // Notification Settings
    notifyOnRsvp: zod_1.z.boolean().default(true),
    notifyOnCheckIn: zod_1.z.boolean().default(false),
    notifyOnGuestbook: zod_1.z.boolean().default(false),
    emailNotifications: zod_1.z.boolean().default(true),
    smsNotifications: zod_1.z.boolean().default(false),
    whatsappNotifications: zod_1.z.boolean().default(false),
    // Reel Generation
    reelEnabled: zod_1.z.boolean().default(false),
    // Ticketing/Pricing
    rsvpMode: zod_1.z.enum(['free', 'paid']).default('free'),
    ticketingEnabled: zod_1.z.boolean().default(false),
    feeOverridesEnabled: zod_1.z.boolean().default(false),
    platformFeeMode: zod_1.z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
    platformFeePercent: zod_1.z.number().min(0).max(100).default(5),
    platformFeeFixed: zod_1.z.number().min(0).optional().nullable(),
    processingFeePercent: zod_1.z.number().min(0).max(100).default(2.9),
    processingFeeFixed: zod_1.z.number().min(0).default(0.30),
});
exports.updateEventSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    slug: zod_1.z.string().min(2).regex(/^[a-z0-9-]+$/).optional(),
    description: zod_1.z.string().optional().nullable(),
    socialTitle: zod_1.z.string().max(120).optional().nullable(),
    socialDescription: zod_1.z.string().max(240).optional().nullable(),
    coverImagePath: zod_1.z.string().optional().nullable(),
    coverImageAlt: zod_1.z.string().max(160).optional().nullable(),
    date: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional().nullable(),
    timezone: zod_1.z.string().optional(),
    venue: zod_1.z.string().optional().nullable(),
    defaultCurrency: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
        .optional(),
    // Owner
    ownerId: zod_1.z.string().uuid().optional().nullable(),
    // Owner Contact
    ownerName: zod_1.z.string().optional().nullable(),
    ownerEmail: zod_1.z.string().email().optional().nullable(),
    ownerPhone: zod_1.z.string().optional().nullable(),
    organizationName: zod_1.z.string().optional().nullable(),
    // Event Styling
    primaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    secondaryColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    accentColor: zod_1.z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    // Service Flags
    invitationEnabled: zod_1.z.boolean().optional(),
    rsvpEnabled: zod_1.z.boolean().optional(),
    guestbookEnabled: zod_1.z.boolean().optional(),
    checkInEnabled: zod_1.z.boolean().optional(),
    invitationOnly: zod_1.z.boolean().optional(),
    strictInviteOnly: zod_1.z.boolean().optional(),
    itineraryEnabled: zod_1.z.boolean().optional(),
    itineraryTemplateId: zod_1.z.string().uuid().optional().nullable(),
    giftingEnabled: zod_1.z.boolean().optional(),
    itineraryPageTemplateId: zod_1.z.string().uuid().optional().nullable(),
    giftingPageTemplateId: zod_1.z.string().uuid().optional().nullable(),
    // Template Assignments - ⭐ INCLUDES NEW TEMPLATE TYPES
    invitationTemplateId: zod_1.z.string().uuid().optional().nullable(),
    rsvpTemplateId: zod_1.z.string().uuid().optional().nullable(),
    guestbookTemplateId: zod_1.z.string().uuid().optional().nullable(),
    guestbookVideoTemplateId: zod_1.z.string().uuid().optional().nullable(),
    guestbookAudioTemplateId: zod_1.z.string().uuid().optional().nullable(),
    guestbookPhotoTemplateId: zod_1.z.string().uuid().optional().nullable(),
    boothTemplateId: zod_1.z.string().uuid().optional().nullable(),
    boothVideoTemplateId: zod_1.z.string().uuid().optional().nullable(),
    boothAudioTemplateId: zod_1.z.string().uuid().optional().nullable(),
    boothPhotoTemplateId: zod_1.z.string().uuid().optional().nullable(),
    thankYouTemplateId: zod_1.z.string().uuid().optional().nullable(),
    liveLandingTemplateId: zod_1.z.string().uuid().optional().nullable(), // ⭐ NEW
    eventEndedTemplateId: zod_1.z.string().uuid().optional().nullable(), // ⭐ NEW
    // Guestbook Settings
    maxRecordingDuration: zod_1.z.number().int().min(30).max(300).optional(),
    minRecordingDuration: zod_1.z.number().int().min(5).max(60).optional(),
    maxPhotosPerGuest: zod_1.z.number().int().min(1).max(50).optional(),
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
    // Ticketing/Pricing
    rsvpMode: zod_1.z.enum(['free', 'paid']).optional(),
    ticketingEnabled: zod_1.z.boolean().optional(),
    feeOverridesEnabled: zod_1.z.boolean().optional(),
    platformFeeMode: zod_1.z.enum(['PERCENTAGE', 'FIXED']).optional(),
    platformFeePercent: zod_1.z.number().min(0).max(100).optional(),
    platformFeeFixed: zod_1.z.number().min(0).optional().nullable(),
    processingFeePercent: zod_1.z.number().min(0).max(100).optional(),
    processingFeeFixed: zod_1.z.number().min(0).optional(),
});
// ============================================
// TEMPLATE SCHEMAS - ⭐ INCLUDES NEW TYPES
// ============================================
exports.createTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Template name must be at least 2 characters'),
    description: zod_1.z.string().optional(),
    // ⭐ NOW INCLUDES: LIVE_LANDING | EVENT_ENDED
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
        'THANK_YOU',
        'LIVE_LANDING', // ⭐ NEW
        'EVENT_ENDED', // ⭐ NEW
        'ITINERARY',
        'GIFTING',
    ]),
    htmlContent: zod_1.z.string().min(1, 'HTML content is required'),
    cssContent: zod_1.z.string().optional(),
    jsContent: zod_1.z.string().optional(),
    variables: zod_1.z.string().optional(),
    isDefault: zod_1.z.boolean().default(false),
});
exports.updateTemplateSchema = exports.createTemplateSchema.partial();
// ============================================
// RSVP SCHEMAS
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
    customFields: zod_1.z.string().optional(), // JSON string
    submissionChannel: zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'WEB']).default('WEB'),
});
exports.reviewRsvpSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
});
// ============================================
// CHECK-IN SCHEMAS
// ============================================
exports.checkInSchema = zod_1.z.object({
    token: zod_1.z.string().optional(),
    accessCode: zod_1.z.string().length(6, 'Access code must be 6 digits').optional(),
    method: zod_1.z.enum(['QR_SCAN', 'MANUAL_CODE']),
    deviceInfo: zod_1.z.string().optional(),
}).refine((data) => data.token || data.accessCode, { message: 'Either token or accessCode is required' });
// ============================================
// GUESTBOOK SCHEMAS
// ============================================
exports.mediaUploadSchema = zod_1.z.object({
    type: zod_1.z.enum(['VIDEO', 'AUDIO', 'PHOTO']),
    guestName: zod_1.z.string().optional(),
    guestEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    captureMode: zod_1.z.enum(['PERSONAL', 'BOOTH']).default('PERSONAL'),
    deviceId: zod_1.z.string().optional(),
    duration: zod_1.z.number().optional(),
});
// ============================================
// BROADCAST SCHEMAS
// ============================================
exports.createBroadcastSchema = zod_1.z.object({
    subject: zod_1.z.string().optional(),
    message: zod_1.z.string().min(1, 'Message is required').max(1000),
    audience: zod_1.z.enum(['ALL_RSVPS', 'APPROVED_ONLY']),
    channels: zod_1.z.array(zod_1.z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1),
});
// ============================================
// OWNER SCHEMAS
// ============================================
exports.createOwnerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Invalid email address'),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
});
exports.updateOwnerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional().nullable(),
    company: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
//# sourceMappingURL=validation.js.map