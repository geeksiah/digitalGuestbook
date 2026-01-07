import { z } from 'zod';

// ============================================
// AUTH SCHEMAS
// ============================================

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerAdminSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['admin', 'superadmin']).default('admin'),
});

// ============================================
// EVENT SCHEMAS
// ============================================

export const createEventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  slug: z.string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().optional(),
  date: z.string().datetime('Invalid date format'),
  endDate: z.string().datetime('Invalid date format').optional(),
  timezone: z.string().default('UTC'),
  venue: z.string().optional(),
  
  // Service Flags
  invitationEnabled: z.boolean().default(true),
  rsvpEnabled: z.boolean().default(true),
  guestbookEnabled: z.boolean().default(true),
  checkInEnabled: z.boolean().default(true),
  
  // Invitation-Only Flag
  invitationOnly: z.boolean().default(false),
  
  // Guestbook Settings
  maxRecordingDuration: z.number().min(30).max(120).default(120),
  minRecordingDuration: z.number().min(10).max(60).default(30),
  maxPhotosPerGuest: z.number().min(1).max(20).default(5),
});

export const updateEventSchema = createEventSchema.partial().extend({
  phase: z.enum(['PRE_EVENT', 'LIVE', 'POST_EVENT']).optional(),
  phaseOverride: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// ============================================
// TEMPLATE SCHEMAS
// ============================================

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  description: z.string().optional(),
  type: z.enum(['INVITATION', 'RSVP', 'GUESTBOOK', 'THANK_YOU']),
  htmlContent: z.string().min(1, 'HTML content is required'),
  cssContent: z.string().optional(),
  jsContent: z.string().optional(),
  variables: z.string().optional(), // JSON string
  isDefault: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema.partial();

// ============================================
// RSVP SCHEMAS (SRS Section 4.2)
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
  
  submissionChannel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'WEB']).default('WEB'),
});

export const reviewRsvpSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

// ============================================
// CHECK-IN SCHEMAS (SRS Section 8)
// ============================================

export const checkInSchema = z.object({
  // Either QR code token or 6-digit access code
  token: z.string().optional(),
  accessCode: z.string().length(6, 'Access code must be 6 digits').optional(),
  method: z.enum(['QR_SCAN', 'MANUAL_CODE']),
  deviceInfo: z.string().optional(),
}).refine(
  (data) => data.token || data.accessCode,
  { message: 'Either token or accessCode is required' }
);

// ============================================
// GUESTBOOK SCHEMAS (SRS Section 9)
// ============================================

export const mediaUploadSchema = z.object({
  type: z.enum(['VIDEO', 'AUDIO', 'PHOTO']),
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional().or(z.literal('')),
  captureMode: z.enum(['PERSONAL', 'BOOTH']).default('PERSONAL'),
  deviceId: z.string().optional(),
  duration: z.number().optional(), // For video/audio
});

// ============================================
// BROADCAST SCHEMAS (SRS Section 11)
// ============================================

export const createBroadcastSchema = z.object({
  subject: z.string().optional(),
  message: z.string().min(1, 'Message is required').max(1000),
  audience: z.enum(['ALL_RSVPS', 'APPROVED_ONLY']),
  channels: z.array(z.enum(['EMAIL', 'SMS', 'WHATSAPP'])).min(1),
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
