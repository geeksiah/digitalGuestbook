// COMPLETE DROP-IN REPLACEMENT
// File: backend/src/utils/validation.ts
// Includes: LIVE_LANDING and EVENT_ENDED template types

import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const optionalTemplateIdSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    return normalized.length ? normalized : undefined;
  },
  z.string().min(1).optional()
);

const nullableTemplateIdSchema = z.preprocess(
  (value) => {
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const normalized = value.trim();
    return normalized.length ? normalized : undefined;
  },
  z.string().min(1).nullable().optional()
);

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const registerAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'superadmin']).default('admin'),
});

// ============================================
// EVENT SCHEMAS
// ============================================

export const createEventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  slug: z
    .string()
    .min(2)
    .regex(slugPattern, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional().nullable(),
  socialTitle: z.string().max(120).optional().nullable(),
  socialDescription: z.string().max(240).optional().nullable(),
  coverImagePath: z.string().optional().nullable(),
  coverImageAlt: z.string().max(160).optional().nullable(),
  date: z.string().datetime('Invalid date format'),
  endDate: z.string().datetime().optional().nullable(),
  timezone: z.string().default('UTC'),
  venue: z.string().optional().nullable(),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
    .default('USD'),
  
  // Owner
  ownerId: z.string().uuid().optional(),
  
  // Owner Contact
  ownerName: z.string().optional().nullable(),
  ownerEmail: z.string().email().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  
  // Event Styling
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFD700'),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#1a1a2e'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#ffffff'),
  
  // Service Flags
  invitationEnabled: z.boolean().default(true),
  rsvpEnabled: z.boolean().default(true),
  guestbookEnabled: z.boolean().default(true),
  checkInEnabled: z.boolean().default(true),
  invitationOnly: z.boolean().default(false),
  strictInviteOnly: z.boolean().default(false),
  itineraryEnabled: z.boolean().default(false),
  itineraryTemplateId: nullableTemplateIdSchema,
  giftingEnabled: z.boolean().default(false),
  // Both kinds are on by default, so enabling gifting behaves as it always did.
  giftItemsEnabled: z.boolean().default(true),
  cashGiftsEnabled: z.boolean().default(true),
  itineraryPageTemplateId: nullableTemplateIdSchema,
  giftingPageTemplateId: nullableTemplateIdSchema,
  votingPageTemplateId: nullableTemplateIdSchema,
  nominationPageTemplateId: nullableTemplateIdSchema,
  nomineesPageTemplateId: nullableTemplateIdSchema,
  leaderboardPageTemplateId: nullableTemplateIdSchema,
  
  // Template Assignments - ⭐ INCLUDES NEW TEMPLATE TYPES
  invitationTemplateId: optionalTemplateIdSchema,
  rsvpTemplateId: optionalTemplateIdSchema,
  guestbookTemplateId: optionalTemplateIdSchema,
  guestbookVideoTemplateId: optionalTemplateIdSchema,
  guestbookAudioTemplateId: optionalTemplateIdSchema,
  guestbookPhotoTemplateId: optionalTemplateIdSchema,
  boothTemplateId: optionalTemplateIdSchema,
  boothVideoTemplateId: optionalTemplateIdSchema,
  boothAudioTemplateId: optionalTemplateIdSchema,
  boothPhotoTemplateId: optionalTemplateIdSchema,
  thankYouTemplateId: optionalTemplateIdSchema,
  liveLandingTemplateId: optionalTemplateIdSchema,     // ⭐ NEW
  eventEndedTemplateId: optionalTemplateIdSchema,      // ⭐ NEW
  
  // Guestbook Settings
  maxRecordingDuration: z.number().int().min(30).max(300).default(120),
  minRecordingDuration: z.number().int().min(5).max(60).default(30),
  maxPhotosPerGuest: z.number().int().min(1).max(50).default(5),
  
  // Notification Settings
  notifyOnRsvp: z.boolean().default(true),
  notifyOnCheckIn: z.boolean().default(false),
  notifyOnGuestbook: z.boolean().default(false),
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(false),
  whatsappNotifications: z.boolean().default(false),
  
  // Reel Generation
  reelEnabled: z.boolean().default(false),
  // Ticketing/Pricing
  rsvpMode: z.enum(['free', 'paid']).default('free'),
  ticketingEnabled: z.boolean().default(false),
  feeOverridesEnabled: z.boolean().default(false),
  platformFeeMode: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
  platformFeePercent: z.number().min(0).max(100).default(5),
  platformFeeFixed: z.number().min(0).optional().nullable(),
  processingFeePercent: z.number().min(0).max(100).default(2.9),
  processingFeeFixed: z.number().min(0).default(0.30),
});

export const updateEventSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).regex(slugPattern).optional(),
  description: z.string().optional().nullable(),
  socialTitle: z.string().max(120).optional().nullable(),
  socialDescription: z.string().max(240).optional().nullable(),
  coverImagePath: z.string().optional().nullable(),
  coverImageAlt: z.string().max(160).optional().nullable(),
  date: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  timezone: z.string().optional(),
  venue: z.string().optional().nullable(),
  defaultCurrency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
    .optional(),
  
  // Owner
  ownerId: z.string().uuid().optional().nullable(),
  
  // Owner Contact
  ownerName: z.string().optional().nullable(),
  ownerEmail: z.string().email().optional().nullable(),
  ownerPhone: z.string().optional().nullable(),
  organizationName: z.string().optional().nullable(),
  
  // Event Styling
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  
  // Service Flags
  invitationEnabled: z.boolean().optional(),
  rsvpEnabled: z.boolean().optional(),
  guestbookEnabled: z.boolean().optional(),
  checkInEnabled: z.boolean().optional(),
  invitationOnly: z.boolean().optional(),
  strictInviteOnly: z.boolean().optional(),
  itineraryEnabled: z.boolean().optional(),
  itineraryTemplateId: nullableTemplateIdSchema,
  giftingEnabled: z.boolean().optional(),
  giftItemsEnabled: z.boolean().optional(),
  cashGiftsEnabled: z.boolean().optional(),
  itineraryPageTemplateId: nullableTemplateIdSchema,
  giftingPageTemplateId: nullableTemplateIdSchema,
  votingPageTemplateId: nullableTemplateIdSchema,
  nominationPageTemplateId: nullableTemplateIdSchema,
  nomineesPageTemplateId: nullableTemplateIdSchema,
  leaderboardPageTemplateId: nullableTemplateIdSchema,
  
  // Template Assignments - ⭐ INCLUDES NEW TEMPLATE TYPES
  invitationTemplateId: nullableTemplateIdSchema,
  rsvpTemplateId: nullableTemplateIdSchema,
  guestbookTemplateId: nullableTemplateIdSchema,
  guestbookVideoTemplateId: nullableTemplateIdSchema,
  guestbookAudioTemplateId: nullableTemplateIdSchema,
  guestbookPhotoTemplateId: nullableTemplateIdSchema,
  boothTemplateId: nullableTemplateIdSchema,
  boothVideoTemplateId: nullableTemplateIdSchema,
  boothAudioTemplateId: nullableTemplateIdSchema,
  boothPhotoTemplateId: nullableTemplateIdSchema,
  thankYouTemplateId: nullableTemplateIdSchema,
  liveLandingTemplateId: nullableTemplateIdSchema,     // ⭐ NEW
  eventEndedTemplateId: nullableTemplateIdSchema,      // ⭐ NEW
  
  // Guestbook Settings
  maxRecordingDuration: z.number().int().min(30).max(300).optional(),
  minRecordingDuration: z.number().int().min(5).max(60).optional(),
  maxPhotosPerGuest: z.number().int().min(1).max(50).optional(),
  
  // Notification Settings
  notifyOnRsvp: z.boolean().optional(),
  notifyOnCheckIn: z.boolean().optional(),
  notifyOnGuestbook: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  whatsappNotifications: z.boolean().optional(),
  
  // Phase & Status
  phase: z.enum(['PRE_EVENT', 'LIVE', 'POST_EVENT']).optional(),
  phaseOverride: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  reelEnabled: z.boolean().optional(),
  // Ticketing/Pricing
  rsvpMode: z.enum(['free', 'paid']).optional(),
  ticketingEnabled: z.boolean().optional(),
  feeOverridesEnabled: z.boolean().optional(),
  platformFeeMode: z.enum(['PERCENTAGE', 'FIXED']).optional(),
  platformFeePercent: z.number().min(0).max(100).optional(),
  platformFeeFixed: z.number().min(0).optional().nullable(),
  processingFeePercent: z.number().min(0).max(100).optional(),
  processingFeeFixed: z.number().min(0).optional(),
});

// ============================================
// TEMPLATE SCHEMAS - ⭐ INCLUDES NEW TYPES
// ============================================

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  // ⭐ NOW INCLUDES: LIVE_LANDING | EVENT_ENDED
  type: z.enum([
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
    'LIVE_LANDING',      // ⭐ NEW
    'EVENT_ENDED',       // ⭐ NEW
    'ITINERARY',
    'GIFTING',
    'VOTING',
    'VOTING_NOMINATION',
    'VOTING_NOMINEES',
    'VOTING_LEADERBOARD',
  ]),
  htmlContent: z.string().min(1, 'HTML content is required'),
  cssContent: z.string().optional(),
  jsContent: z.string().optional(),
  variables: z.string().optional(),
  isDefault: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ============================================
// RSVP SCHEMAS
// ============================================

export const createRsvpSchema = z.object({
  primaryName: z.string().min(2, 'Name must be at least 2 characters'),
  secondaryName: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  
  attendance: z.enum(['YES', 'NO', 'MAYBE']),
  guestCount: z.number().int().min(1).max(20).default(1),
  mealPreference: z.string().optional(),
  dietaryNotes: z.string().optional(),
  note: z.string().max(500, 'Note must be under 500 characters').optional(),
  
  customFields: z.string().optional(), // JSON string
  submissionChannel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'WEB']).default('WEB'),
});

export const reviewRsvpSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// ============================================
// CHECK-IN SCHEMAS
// ============================================

export const checkInSchema = z.object({
  token: z.string().optional(),
  accessCode: z.string().length(6, 'Access code must be 6 digits').optional(),
  method: z.enum(['QR_SCAN', 'MANUAL_CODE']),
  deviceInfo: z.string().optional(),
}).refine(
  (data) => data.token || data.accessCode,
  { message: 'Either token or accessCode is required' }
);

// ============================================
// GUESTBOOK SCHEMAS
// ============================================

export const mediaUploadSchema = z.object({
  type: z.enum(['VIDEO', 'AUDIO', 'PHOTO']),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional().or(z.literal('')),
  captureMode: z.enum(['PERSONAL', 'BOOTH']).default('PERSONAL'),
  deviceId: z.string().optional(),
  duration: z.number().optional(),
});

// ============================================
// BROADCAST SCHEMAS
// ============================================

export const createBroadcastSchema = z.object({
  subject: z.string().optional(),
  message: z.string().min(1, 'Message is required').max(1000),
  audience: z.enum(['ALL_RSVPS', 'APPROVED_ONLY']),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1),
});

// ============================================
// OWNER SCHEMAS
// ============================================

export const createOwnerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const updateOwnerSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterAdminInput = z.infer<typeof registerAdminSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateRsvpInput = z.infer<typeof createRsvpSchema>;
export type ReviewRsvpInput = z.infer<typeof reviewRsvpSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
export type CreateOwnerInput = z.infer<typeof createOwnerSchema>;
export type UpdateOwnerInput = z.infer<typeof updateOwnerSchema>;


