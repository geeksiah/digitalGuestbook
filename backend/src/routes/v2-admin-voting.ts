import { randomUUID } from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { z } from 'zod';
import { authenticateAdmin, authenticateOwnerAccount } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import prisma from '../utils/prisma.js';
import { BUCKETS, buildPublicUrl, getPublicUrl, uploadToSupabase } from '../services/supabaseStorage.js';
import { PrismaVotingRepository } from '../modules/voting/core/PrismaVotingRepository.js';
import { VotingService } from '../modules/voting/core/VotingService.js';

const router = Router();
const votingService = new VotingService(new PrismaVotingRepository(prisma));

router.use((req, res, next) => {
  if (req.baseUrl.includes('/api/v2/admin-voting')) {
    return authenticateAdmin(req, res, next);
  }
  return authenticateOwnerAccount(req, res, next);
});

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!String(file.mimetype || '').startsWith('image/')) {
      cb(new AppError('Please upload an image file', 400));
      return;
    }
    cb(null, true);
  },
});

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const resolveMediaUrl = (mediaPath: string | null | undefined) => {
  if (!mediaPath) return null;
  const normalized = String(mediaPath).trim();
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  try {
    return getPublicUrl(BUCKETS.MEDIA, normalized);
  } catch {
    try {
      return buildPublicUrl(BUCKETS.MEDIA, normalized);
    } catch {
      return normalized;
    }
  }
};

const getActorIds = (req: any) => ({
  ownerId: String(req.ownerId || '').trim() || null,
  adminId: String(req.admin?.id || '').trim() || null,
});

const ensureManagedEvent = async (eventId: string, ownerId?: string | null, adminId?: string | null) => {
  const event = adminId
    ? await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          ownerId: true,
          name: true,
          defaultCurrency: true,
          votingConfig: true,
        },
      })
    : await prisma.event.findFirst({
        where: {
          id: eventId,
          ownerId: ownerId || undefined,
        },
        select: {
          id: true,
          ownerId: true,
          name: true,
          defaultCurrency: true,
          votingConfig: true,
        },
      });
  if (!event) throw new AppError('Event not found', 404);
  return event;
};

const nominationFieldSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  type: z.enum(['text', 'textarea', 'email', 'phone', 'number', 'select']),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional().nullable(),
  options: z.array(z.string().max(120)).optional(),
});

const categorySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  label: z.string().min(1).max(120),
  description: z.string().max(300).optional().nullable(),
  isActive: z.boolean().optional(),
});

const contestSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().nullable(),
  mode: z.enum(['AWARDS', 'ELECTION']).optional(),
  isActive: z.boolean().optional(),
  allowPublicNominations: z.boolean().optional(),
  nominationFormFields: z.array(nominationFieldSchema).optional(),
  categories: z.array(categorySchema).optional(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  sortOrder: z.number().int().optional(),
  metadataJson: z.record(z.unknown()).optional(),
});

const optionSchema = z.object({
  name: z.string().min(2).max(160),
  description: z.string().max(2000).optional().nullable(),
  imagePath: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  metadataJson: z.record(z.unknown()).optional(),
});

const configSchema = z.object({
  mode: z.enum(['AWARDS', 'ELECTION']).optional(),
  isEnabled: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  allowFreeVotes: z.boolean().optional(),
  allowPaidVotes: z.boolean().optional(),
  allowPublicNominations: z.boolean().optional(),
  requireOtpForElection: z.boolean().optional(),
  freeVoteScope: z.enum(['EVENT', 'CONTEST']).optional(),
  voteUnitPrice: z.number().nonnegative().optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
  maxVotesPerPurchase: z.number().int().min(1).max(10000).optional(),
  freeVoteLabel: z.string().max(120).optional().nullable(),
  paidVoteLabel: z.string().max(120).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  settingsJson: z.record(z.unknown()).optional(),
});

const reviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional().nullable(),
  createNomineeOnApprove: z.boolean().optional(),
});

const withCategories = (contest: {
  metadataJson: string | null;
  nominationFormFieldsJson: string | null;
}) => {
  const metadata = parseJson<Record<string, unknown>>(contest.metadataJson, {});
  const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
  const nominationFormFields = parseJson<any[]>(contest.nominationFormFieldsJson, []);
  return {
    categories,
    nominationFormFields,
  };
};

router.get(
  '/events/:eventId/config',
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const config = event.votingConfig || (await votingService.configureVoting(event.id, { currency: event.defaultCurrency }));
    res.json({ config });
  })
);

router.put(
  '/events/:eventId/config',
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const input = configSchema.parse(req.body || {});
    const config = await votingService.configureVoting(event.id, {
      ...input,
      currency: event.defaultCurrency || input.currency,
      startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
    });
    res.json({ config });
  })
);

router.get(
  '/events/:eventId/contests',
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);

    const contests = await prisma.votingContest.findMany({
      where: { eventId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      contests: contests.map((contest) => {
        const extras = withCategories(contest);
        return {
          ...contest,
          ...extras,
          options: contest.options.map((option) => ({
            ...option,
            imageUrl: resolveMediaUrl(option.imagePath),
          })),
        };
      }),
    });
  })
);

router.post(
  '/events/:eventId/contests',
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = contestSchema.parse(req.body || {});

    const metadata = {
      ...(input.metadataJson || {}),
      categories: (input.categories || []).map((item) => ({
        id: item.id || randomUUID(),
        label: item.label,
        description: item.description || null,
        isActive: item.isActive ?? true,
      })),
    };

    const contest = await prisma.votingContest.create({
      data: {
        eventId,
        title: input.title,
        description: input.description ?? null,
        mode: input.mode || 'AWARDS',
        isActive: input.isActive ?? true,
        allowPublicNominations: input.allowPublicNominations ?? false,
        nominationFormFieldsJson: input.nominationFormFields ? JSON.stringify(input.nominationFormFields) : null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        sortOrder: input.sortOrder ?? 0,
        metadataJson: JSON.stringify(metadata),
      },
    });

    res.status(201).json({ contest });
  })
);

router.patch(
  '/events/:eventId/contests/:contestId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = contestSchema.partial().parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({
      where: { id: contestId, eventId },
    });
    if (!contest) throw new AppError('Contest not found', 404);

    const currentMetadata = parseJson<Record<string, unknown>>(contest.metadataJson, {});
    const nextMetadata =
      input.categories === undefined && input.metadataJson === undefined
        ? undefined
        : {
            ...currentMetadata,
            ...(input.metadataJson || {}),
            ...(input.categories
              ? {
                  categories: input.categories.map((item) => ({
                    id: item.id || randomUUID(),
                    label: item.label,
                    description: item.description || null,
                    isActive: item.isActive ?? true,
                  })),
                }
              : {}),
          };

    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: {
        title: input.title ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        mode: input.mode ?? undefined,
        isActive: input.isActive ?? undefined,
        allowPublicNominations: input.allowPublicNominations ?? undefined,
        nominationFormFieldsJson:
          input.nominationFormFields === undefined
            ? undefined
            : input.nominationFormFields
            ? JSON.stringify(input.nominationFormFields)
            : null,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
        sortOrder: input.sortOrder ?? undefined,
        metadataJson: nextMetadata === undefined ? undefined : JSON.stringify(nextMetadata),
      },
    });

    res.json({ contest: updated });
  })
);

router.delete(
  '/events/:eventId/contests/:contestId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId }, select: { id: true } });
    if (!contest) throw new AppError('Contest not found', 404);
    await prisma.votingContest.delete({ where: { id: contest.id } });
    res.json({ message: 'Contest deleted' });
  })
);

router.get(
  '/events/:eventId/contests/:contestId/categories',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const { categories } = withCategories(contest);
    res.json({ categories });
  })
);

router.post(
  '/events/:eventId/contests/:contestId/categories',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = categorySchema.parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const metadata = parseJson<Record<string, unknown>>(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
    categories.push({
      id: input.id || randomUUID(),
      label: input.label,
      description: input.description || null,
      isActive: input.isActive ?? true,
    });
    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: {
        metadataJson: JSON.stringify({
          ...metadata,
          categories,
        }),
      },
    });
    res.status(201).json({ categories: withCategories(updated).categories });
  })
);

router.patch(
  '/events/:eventId/contests/:contestId/categories/:categoryId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId, categoryId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = categorySchema.partial().parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);

    const metadata = parseJson<Record<string, unknown>>(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? [...metadata.categories] : [];
    const idx = categories.findIndex((category: any) => String(category.id) === categoryId);
    if (idx < 0) throw new AppError('Category not found', 404);
    categories[idx] = {
      ...categories[idx],
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };

    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: {
        metadataJson: JSON.stringify({ ...metadata, categories }),
      },
    });
    res.json({ categories: withCategories(updated).categories });
  })
);

router.delete(
  '/events/:eventId/contests/:contestId/categories/:categoryId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId, categoryId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const metadata = parseJson<Record<string, unknown>>(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
    const nextCategories = categories.filter((category: any) => String(category.id) !== categoryId);
    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: {
        metadataJson: JSON.stringify({ ...metadata, categories: nextCategories }),
      },
    });
    res.json({ categories: withCategories(updated).categories });
  })
);

router.get(
  '/events/:eventId/contests/:contestId/nomination-fields',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma.votingContest.findFirst({
      where: { id: contestId, eventId },
      select: { nominationFormFieldsJson: true },
    });
    if (!contest) throw new AppError('Contest not found', 404);
    res.json({ fields: parseJson<any[]>(contest.nominationFormFieldsJson, []) });
  })
);

router.post(
  '/events/:eventId/contests/:contestId/nomination-fields',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = nominationFieldSchema.parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const fields = parseJson<any[]>(contest.nominationFormFieldsJson, []);
    if (fields.some((item) => String(item.id) === input.id)) {
      throw new AppError('Field id already exists', 409);
    }
    fields.push(input);
    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: { nominationFormFieldsJson: JSON.stringify(fields) },
    });
    res.status(201).json({ fields: parseJson<any[]>(updated.nominationFormFieldsJson, []) });
  })
);

router.patch(
  '/events/:eventId/contests/:contestId/nomination-fields/:fieldId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId, fieldId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = nominationFieldSchema.partial().parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const fields = parseJson<any[]>(contest.nominationFormFieldsJson, []);
    const idx = fields.findIndex((item) => String(item.id) === fieldId);
    if (idx < 0) throw new AppError('Field not found', 404);
    fields[idx] = { ...fields[idx], ...input };
    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: { nominationFormFieldsJson: JSON.stringify(fields) },
    });
    res.json({ fields: parseJson<any[]>(updated.nominationFormFieldsJson, []) });
  })
);

router.delete(
  '/events/:eventId/contests/:contestId/nomination-fields/:fieldId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId, fieldId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest) throw new AppError('Contest not found', 404);
    const fields = parseJson<any[]>(contest.nominationFormFieldsJson, []);
    const filtered = fields.filter((item) => String(item.id) !== fieldId);
    const updated = await prisma.votingContest.update({
      where: { id: contest.id },
      data: { nominationFormFieldsJson: JSON.stringify(filtered) },
    });
    res.json({ fields: parseJson<any[]>(updated.nominationFormFieldsJson, []) });
  })
);

router.get(
  '/events/:eventId/contests/:contestId/options',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const options = await prisma.votingOption.findMany({
      where: { eventId, contestId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({
      options: options.map((option) => ({
        ...option,
        imageUrl: resolveMediaUrl(option.imagePath),
      })),
    });
  })
);

router.post(
  '/events/:eventId/options/upload-image',
  imageUpload.single('image'),
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const file = req.file;
    if (!file) throw new AppError('Image file is required', 400);

    const optimized = await sharp(file.buffer)
      .rotate()
      .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();

    const assetPath = `events/${event.id}/voting/options/${Date.now()}-${randomUUID()}.webp`;
    const uploaded = await uploadToSupabase(BUCKETS.MEDIA, assetPath, optimized, {
      contentType: 'image/webp',
      cacheControl: '31536000, immutable',
      metadata: {
        eventId: event.id,
        purpose: 'voting_option_image',
      },
    });

    res.status(201).json({
      imagePath: uploaded.path,
      imageUrl: uploaded.publicUrl || resolveMediaUrl(uploaded.path),
    });
  })
);

router.post(
  '/events/:eventId/contests/:contestId/options',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = optionSchema.parse(req.body || {});

    const contest = await prisma.votingContest.findFirst({ where: { id: contestId, eventId }, select: { id: true } });
    if (!contest) throw new AppError('Contest not found', 404);

    const option = await prisma.votingOption.create({
      data: {
        eventId,
        contestId: contest.id,
        name: input.name,
        description: input.description ?? null,
        imagePath: input.imagePath ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null,
      },
    });

    res.status(201).json({
      option: {
        ...option,
        imageUrl: resolveMediaUrl(option.imagePath),
      },
    });
  })
);

router.patch(
  '/events/:eventId/options/:optionId',
  asyncHandler(async (req, res) => {
    const { eventId, optionId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = optionSchema.partial().parse(req.body || {});

    const option = await prisma.votingOption.findFirst({ where: { id: optionId, eventId }, select: { id: true } });
    if (!option) throw new AppError('Nominee not found', 404);

    const updated = await prisma.votingOption.update({
      where: { id: option.id },
      data: {
        name: input.name ?? undefined,
        description: input.description === undefined ? undefined : input.description,
        imagePath: input.imagePath === undefined ? undefined : input.imagePath,
        sortOrder: input.sortOrder ?? undefined,
        isActive: input.isActive ?? undefined,
        metadataJson:
          input.metadataJson === undefined
            ? undefined
            : input.metadataJson
            ? JSON.stringify(input.metadataJson)
            : null,
      },
    });
    res.json({
      option: {
        ...updated,
        imageUrl: resolveMediaUrl(updated.imagePath),
      },
    });
  })
);

router.delete(
  '/events/:eventId/options/:optionId',
  asyncHandler(async (req, res) => {
    const { eventId, optionId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const option = await prisma.votingOption.findFirst({ where: { id: optionId, eventId }, select: { id: true } });
    if (!option) throw new AppError('Nominee not found', 404);
    await prisma.votingOption.delete({ where: { id: option.id } });
    res.json({ message: 'Nominee deleted' });
  })
);

router.get(
  '/events/:eventId/nominations',
  asyncHandler(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);

    const status = String(req.query.status || '').trim().toUpperCase();
    const contestId = String(req.query.contestId || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));

    const nominations = await prisma.votingNomination.findMany({
      where: {
        eventId,
        ...(contestId ? { contestId } : {}),
        ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
          ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' }
          : {}),
      },
      include: {
        contest: {
          select: { id: true, title: true, metadataJson: true },
        },
        approvedOption: {
          select: { id: true, name: true, imagePath: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const mapped = nominations.map((item) => {
      const customFields = parseJson<Record<string, unknown>>(item.customFieldsJson, {});
      const categoryId = typeof customFields.categoryId === 'string' ? customFields.categoryId : null;
      const contestMeta = parseJson<Record<string, unknown>>(item.contest?.metadataJson, {});
      const categories = Array.isArray(contestMeta.categories) ? contestMeta.categories : [];
      const category = categories.find((entry: any) => String(entry.id) === categoryId) || null;
      const nomineeImagePath = typeof customFields.__nomineeImagePath === 'string' ? customFields.__nomineeImagePath : null;
      return {
        ...item,
        categoryId,
        category,
        nomineeImagePath,
        nomineeImageUrl: resolveMediaUrl(nomineeImagePath),
      };
    });

    res.json({ nominations: mapped });
  })
);

router.patch(
  '/events/:eventId/nominations/:nominationId/review',
  asyncHandler(async (req, res) => {
    const { eventId, nominationId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = reviewSchema.parse(req.body || {});

    const nomination = await prisma.votingNomination.findFirst({
      where: { id: nominationId, eventId },
    });
    if (!nomination) throw new AppError('Nomination not found', 404);
    if (nomination.status !== 'PENDING') throw new AppError('Nomination already reviewed', 409);

    const reviewed = await prisma.$transaction(async (tx) => {
      let approvedOptionId: string | null = null;
      if (input.status === 'APPROVED' && input.createNomineeOnApprove !== false) {
        const customFields = parseJson<Record<string, unknown>>(nomination.customFieldsJson, {});
        const nomineeImagePath =
          typeof customFields.__nomineeImagePath === 'string' ? customFields.__nomineeImagePath : null;
        const createdOption = await tx.votingOption.create({
          data: {
            eventId,
            contestId: nomination.contestId,
            name: nomination.nomineeName,
            description: nomination.nomineeDescription || undefined,
            imagePath: nomineeImagePath || undefined,
            isActive: true,
            metadataJson: JSON.stringify({
              source: 'PUBLIC_NOMINATION',
              nominationId: nomination.id,
              submitterName: nomination.submitterName,
              submitterEmail: nomination.submitterEmail,
            }),
          },
        });
        approvedOptionId = createdOption.id;
      }

      return tx.votingNomination.update({
        where: { id: nomination.id },
        data: {
          status: input.status,
          reviewedAt: new Date(),
          reviewedByOwnerId: ownerId || null,
          reviewNotes: input.reviewNotes || null,
          approvedOptionId,
        },
        include: {
          approvedOption: true,
        },
      });
    });

    res.json({ nomination: reviewed });
  })
);

export default router;

