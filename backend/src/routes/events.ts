import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes, randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import {
  checkCustomDomainOnNetlify,
  isNetlifyDomainAutomationConfigured,
  provisionCustomDomainOnNetlify,
  removeCustomDomainFromNetlify,
  removeCustomDomainsFromNetlify,
} from '../services/customDomainHosting.js';
import { buildDomainVerificationNote, verifyCustomDomainDns } from '../services/customDomainDns.js';
import multer from 'multer';
import sharp from 'sharp';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createEventSchema, updateEventSchema } from '../utils/validation.js';
import { calculateEventPhase } from '../utils/phase.js';
import { BUCKETS, buildPublicUrl, deleteFromSupabase, getPublicUrl, uploadToSupabase } from '../services/supabaseStorage.js';

const router = Router();
const coverUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      cb(new AppError('Only image files are allowed for covers', 400));
      return;
    }
    cb(null, true);
  },
});

const normalizeDomainHost = (rawHost: string) =>
  rawHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '')
    .replace(/\.$/, '');

const isValidDomainHost = (host: string) =>
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);

const resolveCoverUrl = (coverImagePath: string | null | undefined) => {
  if (!coverImagePath) return null;
  if (coverImagePath.startsWith('http://') || coverImagePath.startsWith('https://')) {
    return coverImagePath;
  }
  try {
    return getPublicUrl(BUCKETS.MEDIA, coverImagePath);
  } catch {
    try {
      return buildPublicUrl(BUCKETS.MEDIA, coverImagePath);
    } catch {
      return coverImagePath.startsWith('/') ? coverImagePath : `/${coverImagePath}`;
    }
  }
};

const DEFAULT_VOTING_TEMPLATE_IDS = {
  VOTING: 'default-voting',
  VOTING_NOMINATION: 'default-voting-nomination',
  VOTING_NOMINEES: 'default-voting-nominees',
  VOTING_LEADERBOARD: 'default-voting-leaderboard',
} as const;

type EventVotingTemplateState = {
  votingPageTemplateId?: string | null;
  nominationPageTemplateId?: string | null;
  nomineesPageTemplateId?: string | null;
  leaderboardPageTemplateId?: string | null;
};

const resolveDefaultTemplateId = async (
  templateType: keyof typeof DEFAULT_VOTING_TEMPLATE_IDS
) => {
  const preferredId = DEFAULT_VOTING_TEMPLATE_IDS[templateType];
  const hardDefault = await prisma.template.findFirst({
    where: {
      id: preferredId,
      type: templateType,
    },
    select: { id: true },
  });
  if (hardDefault?.id) return hardDefault.id;

  const fallback = await prisma.template.findFirst({
    where: {
      type: templateType,
      isDefault: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return fallback?.id || null;
};

const ensureDefaultVotingTemplateAssignments = async (
  eventId: string,
  currentTemplates: EventVotingTemplateState
) => {
  const patch: Record<string, string> = {};

  if (!currentTemplates.votingPageTemplateId) {
    const defaultId = await resolveDefaultTemplateId('VOTING');
    if (defaultId) patch.votingPageTemplateId = defaultId;
  }
  if (!currentTemplates.nominationPageTemplateId) {
    const defaultId = await resolveDefaultTemplateId('VOTING_NOMINATION');
    if (defaultId) patch.nominationPageTemplateId = defaultId;
  }
  if (!currentTemplates.nomineesPageTemplateId) {
    const defaultId = await resolveDefaultTemplateId('VOTING_NOMINEES');
    if (defaultId) patch.nomineesPageTemplateId = defaultId;
  }
  if (!currentTemplates.leaderboardPageTemplateId) {
    const defaultId = await resolveDefaultTemplateId('VOTING_LEADERBOARD');
    if (defaultId) patch.leaderboardPageTemplateId = defaultId;
  }

  if (!Object.keys(patch).length) return currentTemplates;

  await prisma.event.updateMany({
    where: {
      id: eventId,
      ...(patch.votingPageTemplateId ? { votingPageTemplateId: null } : {}),
      ...(patch.nominationPageTemplateId ? { nominationPageTemplateId: null } : {}),
      ...(patch.nomineesPageTemplateId ? { nomineesPageTemplateId: null } : {}),
      ...(patch.leaderboardPageTemplateId ? { leaderboardPageTemplateId: null } : {}),
    },
    data: patch,
  });

  return { ...currentTemplates, ...patch };
};

type EventTemplateValidationFlags = {
  invitationEnabled: boolean;
  rsvpEnabled: boolean;
  guestbookEnabled: boolean;
  itineraryEnabled: boolean;
  giftingEnabled: boolean;
};

type TemplateRule = {
  field: string;
  templateType: string;
  serviceFlag?: keyof EventTemplateValidationFlags;
  serviceLabel?: string;
};

const TEMPLATE_RULES: TemplateRule[] = [
  { field: 'invitationTemplateId', templateType: 'INVITATION', serviceFlag: 'invitationEnabled', serviceLabel: 'invitation' },
  { field: 'rsvpTemplateId', templateType: 'RSVP', serviceFlag: 'rsvpEnabled', serviceLabel: 'RSVP' },
  { field: 'guestbookTemplateId', templateType: 'GUESTBOOK', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook' },
  { field: 'guestbookVideoTemplateId', templateType: 'GUESTBOOK_VIDEO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook' },
  { field: 'guestbookAudioTemplateId', templateType: 'GUESTBOOK_AUDIO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook' },
  { field: 'guestbookPhotoTemplateId', templateType: 'GUESTBOOK_PHOTO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook' },
  { field: 'boothTemplateId', templateType: 'BOOTH', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook/booth' },
  { field: 'boothVideoTemplateId', templateType: 'BOOTH_VIDEO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook/booth' },
  { field: 'boothAudioTemplateId', templateType: 'BOOTH_AUDIO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook/booth' },
  { field: 'boothPhotoTemplateId', templateType: 'BOOTH_PHOTO', serviceFlag: 'guestbookEnabled', serviceLabel: 'guestbook/booth' },
  { field: 'thankYouTemplateId', templateType: 'THANK_YOU' },
  { field: 'liveLandingTemplateId', templateType: 'LIVE_LANDING' },
  { field: 'eventEndedTemplateId', templateType: 'EVENT_ENDED' },
  { field: 'itineraryTemplateId', templateType: 'ITINERARY', serviceFlag: 'itineraryEnabled', serviceLabel: 'itinerary' },
  { field: 'itineraryPageTemplateId', templateType: 'ITINERARY', serviceFlag: 'itineraryEnabled', serviceLabel: 'itinerary' },
  { field: 'giftingPageTemplateId', templateType: 'GIFTING', serviceFlag: 'giftingEnabled', serviceLabel: 'gifting' },
  { field: 'votingPageTemplateId', templateType: 'VOTING' },
  { field: 'nominationPageTemplateId', templateType: 'VOTING_NOMINATION' },
  { field: 'nomineesPageTemplateId', templateType: 'VOTING_NOMINEES' },
  { field: 'leaderboardPageTemplateId', templateType: 'VOTING_LEADERBOARD' },
];

const hasOwn = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

const normalizeTemplateReferenceValue = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
};

const validateEventTemplateReferences = async (
  payload: Record<string, unknown>,
  flags: EventTemplateValidationFlags
) => {
  const normalizedAssignments: Record<string, string | null> = {};

  for (const rule of TEMPLATE_RULES) {
    if (!hasOwn(payload, rule.field)) continue;
    const normalizedValue = normalizeTemplateReferenceValue(payload[rule.field]);
    if (normalizedValue === undefined) continue;

    if (normalizedValue === null) {
      normalizedAssignments[rule.field] = null;
      continue;
    }

    if (rule.serviceFlag && !flags[rule.serviceFlag]) {
      throw new AppError(
        `Cannot assign ${rule.templateType} template while ${rule.serviceLabel || rule.serviceFlag} is disabled`,
        400
      );
    }

    const template = await prisma.template.findUnique({
      where: { id: normalizedValue },
      select: { id: true, type: true },
    });

    if (!template) {
      throw new AppError(`Template not found for ${rule.field}`, 400);
    }

    if (template.type !== rule.templateType) {
      throw new AppError(
        `Invalid ${rule.templateType} template. Expected type ${rule.templateType}, got ${template.type}`,
        400
      );
    }

    normalizedAssignments[rule.field] = normalizedValue;
  }

  return normalizedAssignments;
};

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/events
 * List all events with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { archived, phase } = req.query;

  const where: any = {};
  
  if (archived === 'true') {
    where.isArchived = true;
  } else if (archived === 'false') {
    where.isArchived = false;
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
        },
      },
      domains: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  // Calculate current phase for each event
  const eventsWithPhase = events.map((event) => ({
    ...event,
    currentPhase: calculateEventPhase(event),
    coverImageUrl: resolveCoverUrl(event.coverImagePath),
  }));

  // Filter by phase if requested
  const filtered = phase
    ? eventsWithPhase.filter((e) => e.currentPhase === phase)
    : eventsWithPhase;

  res.json({ events: filtered });
}));

/**
 * GET /api/events/:id
 * Get single event details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      thankYouTemplate: true,
      liveLandingTemplate: true,
      eventEndedTemplate: true,
      itineraryPageTemplate: true,
      giftingPageTemplate: true,
      votingPageTemplate: true,
      nominationPageTemplate: true,
      nomineesPageTemplate: true,
      leaderboardPageTemplate: true,
      domains: {
        orderBy: { createdAt: 'asc' },
      },
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
        },
      },
    },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
      coverImageUrl: resolveCoverUrl(event.coverImagePath),
    },
  });
}));

/**
 * POST /api/events
 * Create new event
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);
  const normalizedTemplateAssignments = await validateEventTemplateReferences(
    data as unknown as Record<string, unknown>,
    {
      invitationEnabled: data.invitationEnabled,
      rsvpEnabled: data.rsvpEnabled,
      guestbookEnabled: data.guestbookEnabled,
      itineraryEnabled: data.itineraryEnabled,
      giftingEnabled: data.giftingEnabled,
    }
  );
  const votingEnabledRequested = Boolean((req.body as { votingEnabled?: boolean } | undefined)?.votingEnabled);
  
  // Enforce logic: check-in disabled when invitation-only is false
  if (!data.invitationOnly && data.checkInEnabled) {
    data.checkInEnabled = false;
  }

  // Check if slug is unique
  const existing = await prisma.event.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new AppError('Event slug already exists', 400);
  }

  const event = await prisma.event.create({
    data: {
      ...data,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      socialTitle: data.socialTitle ?? null,
      socialDescription: data.socialDescription ?? null,
      coverImagePath: data.coverImagePath ?? null,
      coverImageAlt: data.coverImageAlt ?? null,
      ownerName: data.ownerName ?? null,
      ownerEmail: data.ownerEmail ?? null,
      ownerPhone: data.ownerPhone ?? null,
      organizationName: data.organizationName ?? null,
      itineraryTemplateId: normalizedTemplateAssignments.itineraryTemplateId ?? data.itineraryTemplateId ?? null,
      itineraryPageTemplateId: normalizedTemplateAssignments.itineraryPageTemplateId ?? data.itineraryPageTemplateId ?? null,
      giftingPageTemplateId: normalizedTemplateAssignments.giftingPageTemplateId ?? data.giftingPageTemplateId ?? null,
      votingPageTemplateId: normalizedTemplateAssignments.votingPageTemplateId ?? data.votingPageTemplateId ?? null,
      nominationPageTemplateId: normalizedTemplateAssignments.nominationPageTemplateId ?? data.nominationPageTemplateId ?? null,
      nomineesPageTemplateId: normalizedTemplateAssignments.nomineesPageTemplateId ?? data.nomineesPageTemplateId ?? null,
      leaderboardPageTemplateId: normalizedTemplateAssignments.leaderboardPageTemplateId ?? data.leaderboardPageTemplateId ?? null,
      invitationTemplateId: normalizedTemplateAssignments.invitationTemplateId ?? data.invitationTemplateId ?? null,
      rsvpTemplateId: normalizedTemplateAssignments.rsvpTemplateId ?? data.rsvpTemplateId ?? null,
      guestbookTemplateId: normalizedTemplateAssignments.guestbookTemplateId ?? data.guestbookTemplateId ?? null,
      guestbookVideoTemplateId: normalizedTemplateAssignments.guestbookVideoTemplateId ?? data.guestbookVideoTemplateId ?? null,
      guestbookAudioTemplateId: normalizedTemplateAssignments.guestbookAudioTemplateId ?? data.guestbookAudioTemplateId ?? null,
      guestbookPhotoTemplateId: normalizedTemplateAssignments.guestbookPhotoTemplateId ?? data.guestbookPhotoTemplateId ?? null,
      boothTemplateId: normalizedTemplateAssignments.boothTemplateId ?? data.boothTemplateId ?? null,
      boothVideoTemplateId: normalizedTemplateAssignments.boothVideoTemplateId ?? data.boothVideoTemplateId ?? null,
      boothAudioTemplateId: normalizedTemplateAssignments.boothAudioTemplateId ?? data.boothAudioTemplateId ?? null,
      boothPhotoTemplateId: normalizedTemplateAssignments.boothPhotoTemplateId ?? data.boothPhotoTemplateId ?? null,
      thankYouTemplateId: normalizedTemplateAssignments.thankYouTemplateId ?? data.thankYouTemplateId ?? null,
      liveLandingTemplateId: normalizedTemplateAssignments.liveLandingTemplateId ?? data.liveLandingTemplateId ?? null,
      eventEndedTemplateId: normalizedTemplateAssignments.eventEndedTemplateId ?? data.eventEndedTemplateId ?? null,
      ownerAccessToken: randomUUID(),
    },
  });

  const shouldEnsureVotingDefaults =
    votingEnabledRequested ||
    Boolean(
      event.votingPageTemplateId ||
      event.nominationPageTemplateId ||
      event.nomineesPageTemplateId ||
      event.leaderboardPageTemplateId
    );
  const assignedTemplates = shouldEnsureVotingDefaults
    ? await ensureDefaultVotingTemplateAssignments(event.id, {
        votingPageTemplateId: event.votingPageTemplateId,
        nominationPageTemplateId: event.nominationPageTemplateId,
        nomineesPageTemplateId: event.nomineesPageTemplateId,
        leaderboardPageTemplateId: event.leaderboardPageTemplateId,
      })
    : {
        votingPageTemplateId: event.votingPageTemplateId,
        nominationPageTemplateId: event.nominationPageTemplateId,
        nomineesPageTemplateId: event.nomineesPageTemplateId,
        leaderboardPageTemplateId: event.leaderboardPageTemplateId,
      };
  const createdEvent = { ...event, ...assignedTemplates };

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: createdEvent.id,
      adminId: req.admin!.id,
      action: 'EVENT_CREATED',
      entityType: 'EVENT',
      entityId: createdEvent.id,
      details: JSON.stringify({ name: createdEvent.name, slug: createdEvent.slug }),
    },
  });

  res.status(201).json({
    event: {
      ...createdEvent,
      currentPhase: calculateEventPhase(createdEvent),
      coverImageUrl: resolveCoverUrl(createdEvent.coverImagePath),
    },
  });
}));

/**
 * PATCH /api/events/:id
 * Update event
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateEventSchema.parse(req.body);

  const existing = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Event not found', 404);
  }

  // Check slug uniqueness if changed
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await prisma.event.findUnique({
      where: { slug: data.slug },
    });
    if (slugExists) {
      throw new AppError('Event slug already exists', 400);
    }
  }

  // Validate ownerId if provided
  if (data.ownerId !== undefined) {
    if (data.ownerId === null) {
      // Allow clearing ownerId
    } else {
      const owner = await prisma.owner.findUnique({
        where: { id: data.ownerId },
      });
      if (!owner) {
        throw new AppError('Owner not found', 404);
      }
      if (!owner.isActive) {
        throw new AppError('Cannot assign event to inactive owner', 400);
      }
    }
  }

  const nextServiceFlags: EventTemplateValidationFlags = {
    invitationEnabled: data.invitationEnabled ?? existing.invitationEnabled,
    rsvpEnabled: data.rsvpEnabled ?? existing.rsvpEnabled,
    guestbookEnabled: data.guestbookEnabled ?? existing.guestbookEnabled,
    itineraryEnabled: data.itineraryEnabled ?? existing.itineraryEnabled,
    giftingEnabled: data.giftingEnabled ?? existing.giftingEnabled,
  };
  const normalizedTemplateAssignments = await validateEventTemplateReferences(
    data as unknown as Record<string, unknown>,
    nextServiceFlags
  );

  // Enforce logic: check-in disabled when invitation-only is false
  if (data.invitationOnly === false && data.checkInEnabled !== undefined) {
    data.checkInEnabled = false;
  }

  // Enforce logic: check-in disabled when invitation-only is false
  const resolvedEndDate =
    data.endDate === undefined ? undefined : data.endDate === null ? null : new Date(data.endDate);
  const updateData: any = {
    ...data,
    date: data.date ? new Date(data.date) : undefined,
    endDate: resolvedEndDate,
    socialTitle: data.socialTitle,
    socialDescription: data.socialDescription,
    coverImagePath: data.coverImagePath,
    coverImageAlt: data.coverImageAlt,
    ownerName: data.ownerName,
    ownerEmail: data.ownerEmail,
    ownerPhone: data.ownerPhone,
    organizationName: data.organizationName,
    itineraryTemplateId: hasOwn(normalizedTemplateAssignments, 'itineraryTemplateId')
      ? normalizedTemplateAssignments.itineraryTemplateId
      : data.itineraryTemplateId,
    itineraryPageTemplateId: hasOwn(normalizedTemplateAssignments, 'itineraryPageTemplateId')
      ? normalizedTemplateAssignments.itineraryPageTemplateId
      : data.itineraryPageTemplateId,
    giftingPageTemplateId: hasOwn(normalizedTemplateAssignments, 'giftingPageTemplateId')
      ? normalizedTemplateAssignments.giftingPageTemplateId
      : data.giftingPageTemplateId,
    votingPageTemplateId: hasOwn(normalizedTemplateAssignments, 'votingPageTemplateId')
      ? normalizedTemplateAssignments.votingPageTemplateId
      : data.votingPageTemplateId,
    nominationPageTemplateId: hasOwn(normalizedTemplateAssignments, 'nominationPageTemplateId')
      ? normalizedTemplateAssignments.nominationPageTemplateId
      : data.nominationPageTemplateId,
    nomineesPageTemplateId: hasOwn(normalizedTemplateAssignments, 'nomineesPageTemplateId')
      ? normalizedTemplateAssignments.nomineesPageTemplateId
      : data.nomineesPageTemplateId,
    leaderboardPageTemplateId: hasOwn(normalizedTemplateAssignments, 'leaderboardPageTemplateId')
      ? normalizedTemplateAssignments.leaderboardPageTemplateId
      : data.leaderboardPageTemplateId,
    invitationTemplateId: hasOwn(normalizedTemplateAssignments, 'invitationTemplateId')
      ? normalizedTemplateAssignments.invitationTemplateId
      : data.invitationTemplateId,
    rsvpTemplateId: hasOwn(normalizedTemplateAssignments, 'rsvpTemplateId')
      ? normalizedTemplateAssignments.rsvpTemplateId
      : data.rsvpTemplateId,
    guestbookTemplateId: hasOwn(normalizedTemplateAssignments, 'guestbookTemplateId')
      ? normalizedTemplateAssignments.guestbookTemplateId
      : data.guestbookTemplateId,
    guestbookVideoTemplateId: hasOwn(normalizedTemplateAssignments, 'guestbookVideoTemplateId')
      ? normalizedTemplateAssignments.guestbookVideoTemplateId
      : data.guestbookVideoTemplateId,
    guestbookAudioTemplateId: hasOwn(normalizedTemplateAssignments, 'guestbookAudioTemplateId')
      ? normalizedTemplateAssignments.guestbookAudioTemplateId
      : data.guestbookAudioTemplateId,
    guestbookPhotoTemplateId: hasOwn(normalizedTemplateAssignments, 'guestbookPhotoTemplateId')
      ? normalizedTemplateAssignments.guestbookPhotoTemplateId
      : data.guestbookPhotoTemplateId,
    boothTemplateId: hasOwn(normalizedTemplateAssignments, 'boothTemplateId')
      ? normalizedTemplateAssignments.boothTemplateId
      : data.boothTemplateId,
    boothVideoTemplateId: hasOwn(normalizedTemplateAssignments, 'boothVideoTemplateId')
      ? normalizedTemplateAssignments.boothVideoTemplateId
      : data.boothVideoTemplateId,
    boothAudioTemplateId: hasOwn(normalizedTemplateAssignments, 'boothAudioTemplateId')
      ? normalizedTemplateAssignments.boothAudioTemplateId
      : data.boothAudioTemplateId,
    boothPhotoTemplateId: hasOwn(normalizedTemplateAssignments, 'boothPhotoTemplateId')
      ? normalizedTemplateAssignments.boothPhotoTemplateId
      : data.boothPhotoTemplateId,
    thankYouTemplateId: hasOwn(normalizedTemplateAssignments, 'thankYouTemplateId')
      ? normalizedTemplateAssignments.thankYouTemplateId
      : data.thankYouTemplateId,
    liveLandingTemplateId: hasOwn(normalizedTemplateAssignments, 'liveLandingTemplateId')
      ? normalizedTemplateAssignments.liveLandingTemplateId
      : data.liveLandingTemplateId,
    eventEndedTemplateId: hasOwn(normalizedTemplateAssignments, 'eventEndedTemplateId')
      ? normalizedTemplateAssignments.eventEndedTemplateId
      : data.eventEndedTemplateId,
  };
  
  if (updateData.invitationOnly === false) {
    updateData.checkInEnabled = false;
  }

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: updateData,
  });

  let patchedEvent = event;
  const votingEnabledRequested = Boolean((req.body as { votingEnabled?: boolean } | undefined)?.votingEnabled);
  const shouldEnsureVotingDefaults =
    votingEnabledRequested ||
    Boolean(
      event.votingPageTemplateId ||
      (event as any).nominationPageTemplateId ||
      (event as any).nomineesPageTemplateId ||
      (event as any).leaderboardPageTemplateId
    );
  if (shouldEnsureVotingDefaults) {
    const assignedTemplates = await ensureDefaultVotingTemplateAssignments(event.id, {
      votingPageTemplateId: event.votingPageTemplateId,
      nominationPageTemplateId: (event as any).nominationPageTemplateId,
      nomineesPageTemplateId: (event as any).nomineesPageTemplateId,
      leaderboardPageTemplateId: (event as any).leaderboardPageTemplateId,
    });
    patchedEvent = {
      ...event,
      ...assignedTemplates,
    };
  }

  // Create audit log for phase change
  if (data.phase && data.phase !== existing.phase) {
    await prisma.auditLog.create({
      data: {
        eventId: patchedEvent.id,
        adminId: req.admin!.id,
        action: 'PHASE_CHANGED',
        entityType: 'EVENT',
        entityId: patchedEvent.id,
        details: JSON.stringify({ 
          from: existing.phase, 
          to: data.phase,
          override: data.phaseOverride ?? existing.phaseOverride,
        }),
      },
    });
  }

  res.json({
    event: {
      ...patchedEvent,
      currentPhase: calculateEventPhase(patchedEvent),
      coverImageUrl: resolveCoverUrl(patchedEvent.coverImagePath),
    },
  });
}));

/**
 * POST /api/events/:id/phase
 * Set event phase (with override)
 */
router.post('/:id/phase', asyncHandler(async (req, res) => {
  const { phase, override = true } = req.body;

  if (!['PRE_EVENT', 'LIVE', 'POST_EVENT'].includes(phase)) {
    throw new AppError('Invalid phase value', 400);
  }

  const existing = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Event not found', 404);
  }

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      phase,
      phaseOverride: override,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      adminId: req.admin!.id,
      action: 'PHASE_CHANGED',
      entityType: 'EVENT',
      entityId: event.id,
      details: JSON.stringify({ 
        from: existing.phase, 
        to: phase,
        override,
      }),
    },
  });

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * POST /api/events/:id/reset-phase
 * Reset to automatic phase calculation
 */
router.post('/:id/reset-phase', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { phaseOverride: false },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * POST /api/events/:id/archive
 * Archive event
 */
router.post('/:id/archive', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { isArchived: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      adminId: req.admin!.id,
      action: 'EVENT_ARCHIVED',
      entityType: 'EVENT',
      entityId: event.id,
    },
  });

  res.json({ event });
}));

/**
 * POST /api/events/:id/unarchive
 * Unarchive event
 */
router.post('/:id/unarchive', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { isArchived: false },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({ event });
}));

/**
 * POST /api/events/:id/cover
 * Upload event cover image
 */
router.post('/:id/cover', coverUpload.single('cover'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const file = req.file;
  const alt = (req.body.alt as string | undefined)?.trim() || null;

  if (!file) {
    throw new AppError('Cover image file is required', 400);
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, coverImagePath: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  let coverBuffer: Buffer;
  try {
    const image = sharp(file.buffer).rotate();
    const metadata = await image.metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (width < 800 || height < 420) {
      throw new AppError('Image too small. Please upload at least 800x420 for sharp social previews.', 400);
    }

    coverBuffer = await image
      // Normalize to OG/Twitter card ratio for crisp social previews.
      .resize(1200, 630, {
        fit: 'cover',
        position: 'attention',
        kernel: 'lanczos3',
        withoutEnlargement: true,
      })
      .sharpen({ sigma: 1, m1: 0.8, m2: 0.8 })
      .jpeg({ quality: 94, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Invalid image file. Please upload a valid JPG, PNG, or WEBP image.', 400);
  }

  const coverPath = `events/${id}/cover-${Date.now()}.jpg`;
  const upload = await uploadToSupabase(BUCKETS.MEDIA, coverPath, coverBuffer, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: true,
  });

  if (event.coverImagePath) {
    await deleteFromSupabase(BUCKETS.MEDIA, event.coverImagePath).catch(() => null);
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: {
      coverImagePath: upload.path,
      coverImageAlt: alt,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId: id,
      adminId: req.admin!.id,
      action: 'EVENT_COVER_UPLOADED',
      entityType: 'EVENT',
      entityId: id,
      details: JSON.stringify({ coverImagePath: upload.path, mimeType: 'image/jpeg', width: 1200, height: 630 }),
    },
  });

  res.json({
    event: {
      ...updatedEvent,
      coverImageUrl: resolveCoverUrl(updatedEvent.coverImagePath),
    },
  });
}));

/**
 * DELETE /api/events/:id/cover
 * Delete event cover image
 */
router.delete('/:id/cover', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, coverImagePath: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  if (event.coverImagePath) {
    await deleteFromSupabase(BUCKETS.MEDIA, event.coverImagePath).catch(() => null);
  }

  const updatedEvent = await prisma.event.update({
    where: { id },
    data: { coverImagePath: null, coverImageAlt: null },
  });

  await prisma.auditLog.create({
    data: {
      eventId: id,
      adminId: req.admin!.id,
      action: 'EVENT_COVER_DELETED',
      entityType: 'EVENT',
      entityId: id,
    },
  });

  res.json({
    event: {
      ...updatedEvent,
      coverImageUrl: null,
    },
  });
}));

/**
 * GET /api/events/:eventId/domains
 * List custom domains for an event
 */
router.get('/:eventId/domains', asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const domains = await prisma.eventDomain.findMany({
    where: { eventId },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
  });

  // TLS issuance can finish after the Verify request returns. Reconcile any
  // DNS-verified domains whenever the owner/admin revisits the domain screen.
  const reconciledDomains = await Promise.all(domains.map(async (domain) => {
    if (domain.status !== 'VERIFIED') return domain;
    const hosting = await checkCustomDomainOnNetlify(domain.host);
    if (!hosting.configured) return domain;
    return prisma.eventDomain.update({
      where: { id: domain.id },
      data: { status: 'ACTIVE', verificationNotes: null },
    });
  }));

  res.json({
    domains: reconciledDomains,
    dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
    apexTarget: process.env.DOMAIN_APEX_IP || '75.2.60.5',
  });
}));

/**
 * POST /api/events/:eventId/domains
 * Add custom domain
 */
router.post('/:eventId/domains', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const host = normalizeDomainHost(String(req.body.host || ''));
  const isPrimary = Boolean(req.body.isPrimary);

  if (!isValidDomainHost(host)) {
    throw new AppError('Please provide a valid domain host', 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const existing = await prisma.eventDomain.findUnique({ where: { host } });
  if (existing) {
    throw new AppError('Domain is already connected to another event', 400);
  }

  if (isPrimary) {
    await prisma.eventDomain.updateMany({
      where: { eventId },
      data: { isPrimary: false },
    });
  }

  const verificationToken = randomBytes(16).toString('hex');
  const domain = await prisma.eventDomain.create({
    data: {
      eventId,
      host,
      isPrimary,
      verificationToken,
      status: 'PENDING_VERIFICATION',
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'EVENT_DOMAIN_ADDED',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ host }),
    },
  });

  res.status(201).json({
    domain,
    verification: {
      txtName: `_eventpeepo.${host}`,
      txtHost: '_eventpeepo',
      txtValue: verificationToken,
      cnameName: `www.${host}`,
      cnameHost: 'www',
      cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
      apexName: host,
      apexHost: '@',
      apexValue: process.env.DOMAIN_APEX_IP || '75.2.60.5',
    },
  });
}));

/**
 * POST /api/events/:eventId/domains/:domainId/verify
 * Verify custom domain DNS records
 */
router.post('/:eventId/domains/:domainId/verify', asyncHandler(async (req, res) => {
  const { eventId, domainId } = req.params;
  const cnameTarget = (process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com').toLowerCase();
  const apexTarget = process.env.DOMAIN_APEX_IP || '75.2.60.5';

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });

  if (!domain) {
    throw new AppError('Domain not found', 404);
  }

  const dnsVerification = await verifyCustomDomainDns(
    domain.host,
    domain.verificationToken,
    cnameTarget,
    apexTarget,
  );

  const verified = dnsVerification.verified;
  const hosting = verified
    ? await provisionCustomDomainOnNetlify(domain.host)
    : null;

  let status: 'ACTIVE' | 'VERIFIED' | 'FAILED' = 'FAILED';
  if (verified) {
    // ACTIVE means the hostname is actually routable with managed HTTPS.
    // VERIFIED means DNS is correct but Netlify/TLS is still pending.
    status = hosting?.configured ? 'ACTIVE' : 'VERIFIED';
  }

  const dnsNote = buildDomainVerificationNote(dnsVerification);
  const errorMessage = dnsNote || (hosting && !hosting.configured ? hosting.error || null : null);

  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: {
      status,
      verificationNotes: errorMessage,
    },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'EVENT_DOMAIN_VERIFIED',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({
        host: domain.host,
        status,
        txtMatch: dnsVerification.txtMatch,
        cnameMatch: dnsVerification.cnameMatch,
        apexMatch: dnsVerification.apexMatch,
        hosting,
      }),
    },
  });

  res.json({
    domain: updated,
    verification: {
      ...dnsVerification,
      hosting,
    },
  });
}));

/**
 * PATCH /api/events/:eventId/domains/:domainId/primary
 * Set primary domain for event
 */
router.patch('/:eventId/domains/:domainId/primary', asyncHandler(async (req, res) => {
  const { eventId, domainId } = req.params;

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });

  if (!domain) {
    throw new AppError('Domain not found', 404);
  }

  if (domain.status !== 'ACTIVE') {
    throw new AppError('Only fully active HTTPS domains can be set as primary', 400);
  }

  await prisma.eventDomain.updateMany({
    where: { eventId },
    data: { isPrimary: false },
  });

  const updated = await prisma.eventDomain.update({
    where: { id: domain.id },
    data: { isPrimary: true },
  });

  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'EVENT_DOMAIN_SET_PRIMARY',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ host: domain.host }),
    },
  });

  res.json({ domain: updated });
}));

/**
 * DELETE /api/events/:eventId/domains/:domainId
 * Remove a custom domain
 */
router.delete('/:eventId/domains/:domainId', asyncHandler(async (req, res) => {
  const { eventId, domainId } = req.params;

  const domain = await prisma.eventDomain.findFirst({
    where: { id: domainId, eventId },
  });

  if (!domain) {
    throw new AppError('Domain not found', 404);
  }

  let hostingCleanup = null;
  if (isNetlifyDomainAutomationConfigured()) {
    hostingCleanup = await removeCustomDomainFromNetlify(domain.host);
    if (!hostingCleanup.aliasesRemoved) {
      throw new AppError(hostingCleanup.error || 'Failed to remove domain from Netlify', 502);
    }
  } else if (['VERIFIED', 'ACTIVE'].includes(domain.status)) {
    throw new AppError(
      'Netlify cleanup is not configured. Configure NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN before removing this hosted domain.',
      503,
    );
  }

  await prisma.eventDomain.delete({
    where: { id: domain.id },
  });

  if (domain.isPrimary) {
    const fallback = await prisma.eventDomain.findFirst({
      where: { eventId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (fallback) {
      await prisma.eventDomain.update({
        where: { id: fallback.id },
        data: { isPrimary: true },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'EVENT_DOMAIN_DELETED',
      entityType: 'EVENT_DOMAIN',
      entityId: domain.id,
      details: JSON.stringify({ host: domain.host, hostingCleanup }),
    },
  });

  res.json({ message: 'Domain removed successfully', hostingCleanup });
}));

/**
 * POST /api/events/:id/duplicate
 * Duplicate an event with all its settings
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug } = req.body;

  const originalEvent = await prisma.event.findUnique({
    where: { id },
    include: {
      formFields: true,
      ticketTypes: true,
    },
  });

  if (!originalEvent) {
    throw new AppError('Event not found', 404);
  }

  // Generate new slug if not provided
  let newSlug = slug || `${originalEvent.slug}-copy-${Date.now()}`;
  
  // Ensure slug is unique
  const existing = await prisma.event.findUnique({ where: { slug: newSlug } });
  if (existing) {
    newSlug = `${newSlug}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Generate new owner access token
  const newOwnerToken = uuidv4();

  // Create duplicate event (exclude relations that will be copied separately)
  const { id: _, createdAt: __, updatedAt: ___, ownerAccessToken: ____, formFields: _____, ticketTypes: ______, ...eventData } = originalEvent;
  
  const duplicatedEvent = await prisma.event.create({
    data: {
      ...eventData,
      slug: newSlug,
      name: name || `${originalEvent.name} (Copy)`,
      ownerAccessToken: newOwnerToken,
      isArchived: false, // Reset archived status
    },
  });

  const assignedTemplates = await ensureDefaultVotingTemplateAssignments(duplicatedEvent.id, {
    votingPageTemplateId: duplicatedEvent.votingPageTemplateId,
    nominationPageTemplateId: (duplicatedEvent as any).nominationPageTemplateId,
    nomineesPageTemplateId: (duplicatedEvent as any).nomineesPageTemplateId,
    leaderboardPageTemplateId: (duplicatedEvent as any).leaderboardPageTemplateId,
  });
  const finalDuplicatedEvent = { ...duplicatedEvent, ...assignedTemplates };

  // Copy form fields
  if (originalEvent.formFields.length > 0) {
    await prisma.eventFormField.createMany({
      data: originalEvent.formFields.map(field => ({
        eventId: finalDuplicatedEvent.id,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        sortOrder: field.sortOrder,
      })),
    });
  }

  // Copy ticket types
  if (originalEvent.ticketTypes.length > 0) {
    await prisma.ticketType.createMany({
      data: originalEvent.ticketTypes.map(ticket => ({
        eventId: finalDuplicatedEvent.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        currency: ticket.currency,
        quantityTotal: ticket.quantityTotal,
        maxPerOrder: ticket.maxPerOrder,
        isActive: ticket.isActive,
        sortOrder: ticket.sortOrder,
      })),
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'EVENT_DUPLICATED',
      entityType: 'EVENT',
      entityId: finalDuplicatedEvent.id,
      details: JSON.stringify({
        originalEventId: id,
        newEventId: finalDuplicatedEvent.id,
        newSlug: newSlug,
      }),
    },
  });

  res.status(201).json({
    event: finalDuplicatedEvent,
    message: 'Event duplicated successfully',
  });
}));

/**
 * DELETE /api/events/:id
 * Delete event (superadmin only)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    throw new AppError('Only superadmins can delete events', 403);
  }

  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const eventDomains = await prisma.eventDomain.findMany({
    where: { eventId: event.id },
    select: { host: true, status: true },
  });

  let hostingCleanup = null;
  if (eventDomains.length > 0 && isNetlifyDomainAutomationConfigured()) {
    // Clean every hostname, not only ACTIVE rows, so a stale alias from an older
    // status cannot remain attached to EventPeepo after the event disappears.
    hostingCleanup = await removeCustomDomainsFromNetlify(eventDomains.map((domain) => domain.host));
    if (!hostingCleanup.aliasesRemoved) {
      throw new AppError(hostingCleanup.error || 'Failed to remove event domains from Netlify', 502);
    }
  } else if (eventDomains.some((domain) => ['VERIFIED', 'ACTIVE'].includes(domain.status))) {
    throw new AppError(
      'This event has hosted custom domains, but Netlify cleanup is not configured. Configure NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN before deleting the event.',
      503,
    );
  }

  await prisma.event.delete({
    where: { id: req.params.id },
  });

  // Create audit log
  const adminId = req.admin?.id;
  if (!adminId) {
    throw new AppError('Admin authentication required', 401);
  }

  await prisma.auditLog.create({
    data: {
      adminId,
      action: 'EVENT_DELETED',
      entityType: 'EVENT',
      entityId: req.params.id,
      details: JSON.stringify({ eventName: event.name, slug: event.slug, hostingCleanup }),
    },
  });

  res.json({ message: 'Event deleted successfully' });
}));

/**
 * POST /api/events/:id/templates
 * Assign templates to an event (with per-event asset isolation)
 */
router.post('/:id/templates', asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
    liveLandingTemplateId,
    eventEndedTemplateId,
    itineraryPageTemplateId,
    giftingPageTemplateId,
    votingPageTemplateId,
    nominationPageTemplateId,
    nomineesPageTemplateId,
    leaderboardPageTemplateId,
  } = req.body;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Debug: log incoming assignment payload
  try {
    console.info(`[Events] Assign templates request for event=${eventId} body=${JSON.stringify(req.body)}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.info(`[Events] Assign templates request (unable to stringify body: ${detail})`);
  }

  // Import template assignment logic
  const { copyTemplateAssetsForEvent } = await import('../services/templateIsolation.js');
  
  // Validate template IDs and types
  const templateAssignments: any = {};

  // Helper to validate and add template
  const validateAndAdd = async (
    templateId: string | null | undefined, 
    fieldName: string, 
    expectedType: string, 
    requiresService?: { enabled: boolean; name: string }
  ) => {
    if (templateId === null) {
      templateAssignments[fieldName] = null;
      return;
    }
    if (!templateId) return;
    
    if (requiresService && !requiresService.enabled) {
      throw new AppError(`Cannot assign ${expectedType} template - ${requiresService.name} service is disabled`, 400);
    }
    
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (template?.type !== expectedType) {
      throw new AppError(`Invalid ${expectedType} template. Expected type: ${expectedType}, got: ${template?.type || 'none'}`, 400);
    }
    templateAssignments[fieldName] = templateId;
  };

  await validateAndAdd(invitationTemplateId, 'invitationTemplateId', 'INVITATION', 
    { enabled: event.invitationEnabled, name: 'invitation' });
  await validateAndAdd(rsvpTemplateId, 'rsvpTemplateId', 'RSVP', 
    { enabled: event.rsvpEnabled, name: 'RSVP' });
  await validateAndAdd(guestbookTemplateId, 'guestbookTemplateId', 'GUESTBOOK', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookVideoTemplateId, 'guestbookVideoTemplateId', 'GUESTBOOK_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookAudioTemplateId, 'guestbookAudioTemplateId', 'GUESTBOOK_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookPhotoTemplateId, 'guestbookPhotoTemplateId', 'GUESTBOOK_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(boothTemplateId, 'boothTemplateId', 'BOOTH', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothVideoTemplateId, 'boothVideoTemplateId', 'BOOTH_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothAudioTemplateId, 'boothAudioTemplateId', 'BOOTH_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothPhotoTemplateId, 'boothPhotoTemplateId', 'BOOTH_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(thankYouTemplateId, 'thankYouTemplateId', 'THANK_YOU');
  await validateAndAdd(liveLandingTemplateId, 'liveLandingTemplateId', 'LIVE_LANDING');
  await validateAndAdd(eventEndedTemplateId, 'eventEndedTemplateId', 'EVENT_ENDED');
  await validateAndAdd(itineraryPageTemplateId, 'itineraryPageTemplateId', 'ITINERARY',
    { enabled: event.itineraryEnabled, name: 'itinerary' });
  await validateAndAdd(giftingPageTemplateId, 'giftingPageTemplateId', 'GIFTING',
    { enabled: event.giftingEnabled, name: 'gifting' });
  await validateAndAdd(votingPageTemplateId, 'votingPageTemplateId', 'VOTING');
  await validateAndAdd(nominationPageTemplateId, 'nominationPageTemplateId', 'VOTING_NOMINATION');
  await validateAndAdd(nomineesPageTemplateId, 'nomineesPageTemplateId', 'VOTING_NOMINEES');
  await validateAndAdd(leaderboardPageTemplateId, 'leaderboardPageTemplateId', 'VOTING_LEADERBOARD');

  // Debug: log validated template assignments before copying/updating
  console.info(`[Events] Validated template assignments for event=${eventId}: ${JSON.stringify(templateAssignments)}`);

  // Copy template assets to event-specific directory for isolation
  // This ensures Event A's templates don't leak into Event B
  await copyTemplateAssetsForEvent(eventId, {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
    liveLandingTemplateId,
    eventEndedTemplateId,
    itineraryPageTemplateId,
    giftingPageTemplateId,
    votingPageTemplateId,
    nominationPageTemplateId,
    nomineesPageTemplateId,
    leaderboardPageTemplateId,
  });

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: templateAssignments,
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      guestbookVideoTemplate: true,
      guestbookAudioTemplate: true,
      guestbookPhotoTemplate: true,
      boothTemplate: true,
      boothVideoTemplate: true,
      boothAudioTemplate: true,
      boothPhotoTemplate: true,
      thankYouTemplate: true,
      liveLandingTemplate: true,
      eventEndedTemplate: true,
      itineraryPageTemplate: true,
      giftingPageTemplate: true,
      votingPageTemplate: true,
      nominationPageTemplate: true,
      nomineesPageTemplate: true,
      leaderboardPageTemplate: true,
    },
  });

  console.info(`[Events] Updated event ${eventId} templates: ${JSON.stringify({
    invitationTemplateId: updatedEvent.invitationTemplateId,
    rsvpTemplateId: updatedEvent.rsvpTemplateId,
    guestbookTemplateId: updatedEvent.guestbookTemplateId,
    thankYouTemplateId: updatedEvent.thankYouTemplateId,
    liveLandingTemplateId: updatedEvent.liveLandingTemplateId,
    eventEndedTemplateId: updatedEvent.eventEndedTemplateId,
    itineraryPageTemplateId: updatedEvent.itineraryPageTemplateId,
    giftingPageTemplateId: updatedEvent.giftingPageTemplateId,
    votingPageTemplateId: updatedEvent.votingPageTemplateId,
    nominationPageTemplateId: (updatedEvent as any).nominationPageTemplateId,
    nomineesPageTemplateId: (updatedEvent as any).nomineesPageTemplateId,
    leaderboardPageTemplateId: (updatedEvent as any).leaderboardPageTemplateId,
  })}`);

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'TEMPLATES_ASSIGNED',
      entityType: 'EVENT',
      entityId: eventId,
      details: JSON.stringify(templateAssignments),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  res.json({ event: updatedEvent, message: 'Templates assigned and assets copied successfully' });
}));

/**
 * POST /api/events/:id/regenerate-owner-token
 * Regenerate event owner access token
 */
router.post('/:id/regenerate-owner-token', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { ownerAccessToken: randomUUID() },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({ 
    ownerAccessToken: event.ownerAccessToken,
    ownerPortalUrl: `/event-owner/${event.ownerAccessToken}`,
  });
}));

// Backward-compatible alias
router.post('/:id/regenerate-couple-token', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { ownerAccessToken: randomUUID() },
  });

  res.json({
    ownerAccessToken: event.ownerAccessToken,
    ownerPortalUrl: `/event-owner/${event.ownerAccessToken}`,
  });
}));

/**
 * GET /api/events/:id/stats
 * Get event statistics
 */
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const eventId = req.params.id;

  const [
    totalRsvps,
    pendingRsvps,
    approvedRsvps,
    rejectedRsvps,
    totalGuests,
    checkedIn,
    mediaCount,
  ] = await Promise.all([
    prisma.rSVP.count({ where: { eventId } }),
    prisma.rSVP.count({ where: { eventId, status: 'PENDING' } }),
    prisma.rSVP.count({ where: { eventId, status: 'APPROVED' } }),
    prisma.rSVP.count({ where: { eventId, status: 'REJECTED' } }),
    prisma.rSVP.aggregate({
      where: { eventId, status: 'APPROVED' },
      _sum: { guestCount: true },
    }),
    prisma.invitation.count({ where: { eventId, isCheckedIn: true } }),
    prisma.mediaAsset.count({ where: { eventId } }),
  ]);

  // Attendance breakdown
  const attendanceBreakdown = await prisma.rSVP.groupBy({
    by: ['attendance'],
    where: { eventId },
    _count: true,
  });

  // Media breakdown
  const mediaBreakdown = await prisma.mediaAsset.groupBy({
    by: ['type'],
    where: { eventId },
    _count: true,
  });

  res.json({
    stats: {
      rsvps: {
        total: totalRsvps,
        pending: pendingRsvps,
        approved: approvedRsvps,
        rejected: rejectedRsvps,
      },
      attendance: {
        totalExpected: totalGuests._sum.guestCount || 0,
        checkedIn,
      },
      media: {
        total: mediaCount,
        breakdown: mediaBreakdown.reduce((acc, item) => {
          acc[item.type.toLowerCase()] = item._count;
          return acc;
        }, {} as Record<string, number>),
      },
      attendanceBreakdown: attendanceBreakdown.reduce((acc, item) => {
        acc[item.attendance.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}));

export default router;
