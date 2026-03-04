import { Router } from 'express';
import { z } from 'zod';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import prisma from '../utils/prisma.js';

const router = Router();
router.use(authenticateOwnerAccount);
const DEFAULT_VOTING_TEMPLATE_ID = 'default-voting';

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const nominationFieldSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  type: z.enum(['text', 'textarea', 'email', 'phone', 'number', 'select']),
  required: z.boolean().optional(),
  placeholder: z.string().max(200).optional().nullable(),
  options: z.array(z.string().max(120)).optional(),
});

const ensureOwnerEvent = async (eventId: string, ownerId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: {
      id: true,
      name: true,
      ownerId: true,
      votingPageTemplateId: true,
      votingConfig: true,
    },
  });
  if (!event) throw new AppError('Event not found', 404);
  return event;
};

const assignDefaultVotingTemplateIfNeeded = async (
  eventId: string,
  currentVotingPageTemplateId: string | null | undefined
) => {
  if (currentVotingPageTemplateId) return;

  const hardDefault = await prisma.template.findFirst({
    where: {
      id: DEFAULT_VOTING_TEMPLATE_ID,
      type: 'VOTING',
    },
    select: { id: true },
  });

  const defaultVotingTemplate =
    hardDefault ??
    (await prisma.template.findFirst({
      where: {
        type: 'VOTING',
        isDefault: true,
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }));

  if (!defaultVotingTemplate) return;

  await prisma.event.updateMany({
    where: {
      id: eventId,
      votingPageTemplateId: null,
    },
    data: {
      votingPageTemplateId: defaultVotingTemplate.id,
    },
  });
};

const configSchema = z.object({
  mode: z.enum(['AWARDS', 'ELECTION']).optional(),
  isEnabled: z.boolean().optional(),
  allowFreeVotes: z.boolean().optional(),
  allowPaidVotes: z.boolean().optional(),
  allowPublicNominations: z.boolean().optional(),
  requireOtpForElection: z.boolean().optional(),
  voteUnitPrice: z.number().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  maxVotesPerPurchase: z.number().int().min(1).max(10000).optional(),
  freeVoteLabel: z.string().max(120).optional().nullable(),
  paidVoteLabel: z.string().max(120).optional().nullable(),
  settingsJson: z.record(z.unknown()).optional(),
});

const contestSchema = z.object({
  title: z.string().min(2).max(160),
  description: z.string().max(2000).optional().nullable(),
  mode: z.enum(['AWARDS', 'ELECTION']).optional(),
  isActive: z.boolean().optional(),
  allowPublicNominations: z.boolean().optional(),
  nominationFormFields: z.array(nominationFieldSchema).optional(),
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

const nominationReviewSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(1000).optional().nullable(),
  createNomineeOnApprove: z.boolean().optional(),
});

router.get('/events/:eventId/voting/config', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  const event = await ensureOwnerEvent(eventId, ownerId);

  let config = event.votingConfig;
  if (!config) {
    config = await prisma.votingEventConfig.create({
      data: {
        eventId,
      },
    });
  }

  if (config.isEnabled) {
    await assignDefaultVotingTemplateIfNeeded(eventId, event.votingPageTemplateId);
  }

  res.json({ config });
}));

router.put('/events/:eventId/voting/config', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = configSchema.parse(req.body || {});

  const config = await prisma.votingEventConfig.upsert({
    where: { eventId },
    update: {
      mode: input.mode ?? undefined,
      isEnabled: input.isEnabled ?? undefined,
      allowFreeVotes: input.allowFreeVotes ?? undefined,
      allowPaidVotes: input.allowPaidVotes ?? undefined,
      allowPublicNominations: input.allowPublicNominations ?? undefined,
      requireOtpForElection: input.requireOtpForElection ?? undefined,
      voteUnitPrice: input.voteUnitPrice ?? undefined,
      currency: input.currency?.toUpperCase() ?? undefined,
      maxVotesPerPurchase: input.maxVotesPerPurchase ?? undefined,
      freeVoteLabel: input.freeVoteLabel === undefined ? undefined : input.freeVoteLabel,
      paidVoteLabel: input.paidVoteLabel === undefined ? undefined : input.paidVoteLabel,
      settingsJson:
        input.settingsJson === undefined
          ? undefined
          : input.settingsJson
          ? JSON.stringify(input.settingsJson)
          : null,
    },
    create: {
      eventId,
      mode: input.mode || 'AWARDS',
      isEnabled: input.isEnabled ?? true,
      allowFreeVotes: input.allowFreeVotes ?? true,
      allowPaidVotes: input.allowPaidVotes ?? false,
      allowPublicNominations: input.allowPublicNominations ?? false,
      requireOtpForElection: input.requireOtpForElection ?? true,
      voteUnitPrice: input.voteUnitPrice ?? 1,
      currency: input.currency?.toUpperCase() || 'USD',
      maxVotesPerPurchase: input.maxVotesPerPurchase ?? 100,
      freeVoteLabel: input.freeVoteLabel ?? null,
      paidVoteLabel: input.paidVoteLabel ?? null,
      settingsJson: input.settingsJson ? JSON.stringify(input.settingsJson) : null,
    },
  });

  if (config.isEnabled) {
    await assignDefaultVotingTemplateIfNeeded(eventId, null);
  }

  res.json({ config });
}));

router.get('/events/:eventId/voting/contests', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  const event = await ensureOwnerEvent(eventId, ownerId);

  const contests = await prisma.votingContest.findMany({
    where: { eventId: event.id },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
      _count: {
        select: {
          voteRecords: true,
          voteGrants: true,
          nominations: true,
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const contestsWithParsedFields = contests.map((contest) => ({
    ...contest,
    nominationFormFields: parseJson<any[]>(contest.nominationFormFieldsJson, []),
  }));

  res.json({
    event: {
      id: event.id,
      name: event.name,
    },
    config: event.votingConfig,
    contests: contestsWithParsedFields,
  });
}));

router.post('/events/:eventId/voting/contests', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = contestSchema.parse(req.body || {});

  const created = await prisma.votingContest.create({
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
      metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null,
    },
  });

  res.status(201).json({ contest: created });
}));

router.patch('/events/:eventId/voting/contests/:contestId', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, contestId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = contestSchema.partial().parse(req.body || {});

  const contest = await prisma.votingContest.findFirst({
    where: { id: contestId, eventId },
    select: { id: true },
  });
  if (!contest) throw new AppError('Contest not found', 404);

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
      metadataJson:
        input.metadataJson === undefined
          ? undefined
          : input.metadataJson
          ? JSON.stringify(input.metadataJson)
          : null,
    },
  });

  res.json({ contest: updated });
}));

router.delete('/events/:eventId/voting/contests/:contestId', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, contestId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);

  const contest = await prisma.votingContest.findFirst({
    where: { id: contestId, eventId },
    select: { id: true },
  });
  if (!contest) throw new AppError('Contest not found', 404);

  await prisma.votingContest.delete({ where: { id: contest.id } });
  res.json({ message: 'Contest deleted' });
}));

router.get('/events/:eventId/voting/contests/:contestId/options', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, contestId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);

  const contest = await prisma.votingContest.findFirst({
    where: { id: contestId, eventId },
    select: { id: true, title: true },
  });
  if (!contest) throw new AppError('Contest not found', 404);

  const options = await prisma.votingOption.findMany({
    where: { contestId: contest.id, eventId },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ contest, options });
}));

router.post('/events/:eventId/voting/contests/:contestId/options', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, contestId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = optionSchema.parse(req.body || {});

  const contest = await prisma.votingContest.findFirst({
    where: { id: contestId, eventId },
    select: { id: true },
  });
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

  res.status(201).json({ option });
}));

router.patch('/events/:eventId/voting/options/:optionId', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, optionId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = optionSchema.partial().parse(req.body || {});

  const option = await prisma.votingOption.findFirst({
    where: { id: optionId, eventId },
    select: { id: true },
  });
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

  res.json({ option: updated });
}));

router.delete('/events/:eventId/voting/options/:optionId', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, optionId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);

  const option = await prisma.votingOption.findFirst({
    where: { id: optionId, eventId },
    select: { id: true },
  });
  if (!option) throw new AppError('Nominee not found', 404);

  await prisma.votingOption.delete({ where: { id: option.id } });
  res.json({ message: 'Nominee deleted' });
}));

router.get('/events/:eventId/voting/nominations', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);

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
        select: {
          id: true,
          title: true,
          mode: true,
        },
      },
      approvedOption: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json({ nominations });
}));

router.patch('/events/:eventId/voting/nominations/:nominationId/review', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId, nominationId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);
  const input = nominationReviewSchema.parse(req.body || {});

  const nomination = await prisma.votingNomination.findFirst({
    where: { id: nominationId, eventId },
  });
  if (!nomination) throw new AppError('Nomination not found', 404);
  if (nomination.status !== 'PENDING') {
    throw new AppError('Only pending nominations can be reviewed', 409);
  }

  const reviewed = await prisma.$transaction(async (tx) => {
    let approvedOptionId: string | null = null;
    if (input.status === 'APPROVED' && input.createNomineeOnApprove !== false) {
      const createdOption = await tx.votingOption.create({
        data: {
          eventId,
          contestId: nomination.contestId,
          name: nomination.nomineeName,
          description: nomination.nomineeDescription || undefined,
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
        reviewedByOwnerId: ownerId,
        reviewNotes: input.reviewNotes === undefined ? null : input.reviewNotes,
        approvedOptionId,
      },
      include: {
        approvedOption: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  });

  res.json({ nomination: reviewed });
}));

router.get('/events/:eventId/voting/analytics', asyncHandler(async (req, res) => {
  const ownerId = String((req as any).ownerId || '');
  const { eventId } = req.params;
  await ensureOwnerEvent(eventId, ownerId);

  const [records, contests, options, voteRevenue, paidIntentsCount, nominationStats] = await Promise.all([
    prisma.voteRecord.findMany({
      where: { eventId },
      select: {
        contestId: true,
        optionId: true,
        voterKey: true,
        voteType: true,
        voteCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.votingContest.findMany({
      where: { eventId },
      select: { id: true, title: true, mode: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.votingOption.findMany({
      where: { eventId },
      select: {
        id: true,
        contestId: true,
        name: true,
        totalVotes: true,
        freeVotes: true,
        paidVotes: true,
      },
      orderBy: [{ totalVotes: 'desc' }, { sortOrder: 'asc' }],
    }),
    prisma.transaction.aggregate({
      where: {
        eventId,
        paymentIntent: {
          purpose: 'VOTE',
        },
        status: 'COMPLETED',
      },
      _sum: { grossAmount: true },
      _count: true,
    }),
    prisma.paymentIntent.count({
      where: {
        eventId,
        purpose: 'VOTE',
      },
    }),
    prisma.votingNomination.groupBy({
      by: ['status'],
      where: { eventId },
      _count: { _all: true },
    }),
  ]);

  const totalVotes = records.reduce((sum, record) => sum + record.voteCount, 0);
  const uniqueVoters = new Set(records.map((record) => record.voterKey)).size;
  const freeVotes = records
    .filter((record) => record.voteType === 'FREE')
    .reduce((sum, record) => sum + record.voteCount, 0);
  const paidVotes = records
    .filter((record) => record.voteType === 'PAID')
    .reduce((sum, record) => sum + record.voteCount, 0);

  const paidRevenue = Number(voteRevenue._sum.grossAmount || 0);
  const paidPurchaseCount = voteRevenue._count;
  const conversionRate = uniqueVoters > 0 ? Number(((paidPurchaseCount / uniqueVoters) * 100).toFixed(2)) : 0;
  const paidIntentConversionRate =
    paidIntentsCount > 0 ? Number(((paidPurchaseCount / paidIntentsCount) * 100).toFixed(2)) : 0;
  const nominationTotals = nominationStats.reduce(
    (acc, item) => {
      const count = item._count._all || 0;
      if (item.status === 'PENDING') acc.pending += count;
      if (item.status === 'APPROVED') acc.approved += count;
      if (item.status === 'REJECTED') acc.rejected += count;
      acc.total += count;
      return acc;
    },
    { total: 0, pending: 0, approved: 0, rejected: 0 }
  );

  const perContestMetrics = contests.map((contest) => {
    const contestRecords = records.filter((record) => record.contestId === contest.id);
    const contestVotes = contestRecords.reduce((sum, record) => sum + record.voteCount, 0);
    const contestUniqueVoters = new Set(contestRecords.map((record) => record.voterKey)).size;
    const contestFreeVotes = contestRecords
      .filter((record) => record.voteType === 'FREE')
      .reduce((sum, record) => sum + record.voteCount, 0);
    const contestPaidVotes = contestRecords
      .filter((record) => record.voteType === 'PAID')
      .reduce((sum, record) => sum + record.voteCount, 0);
    return {
      contestId: contest.id,
      title: contest.title,
      mode: contest.mode,
      totalVotes: contestVotes,
      uniqueVoters: contestUniqueVoters,
      freeVotes: contestFreeVotes,
      paidVotes: contestPaidVotes,
    };
  });

  const perNomineeMetrics = options.map((option) => ({
    optionId: option.id,
    contestId: option.contestId,
    name: option.name,
    totalVotes: option.totalVotes,
    freeVotes: option.freeVotes,
    paidVotes: option.paidVotes,
  }));

  const now = Date.now();
  const daySeriesMap = new Map<string, { day: string; votes: number; freeVotes: number; paidVotes: number }>();
  const hourSeriesMap = new Map<string, { hour: string; votes: number }>();
  const nomineeGrowth = new Map<string, { recent: number; previous: number }>();

  for (const record of records) {
    const day = record.createdAt.toISOString().slice(0, 10);
    const hour = `${record.createdAt.toISOString().slice(0, 13)}:00:00Z`;
    const dayBucket = daySeriesMap.get(day) || { day, votes: 0, freeVotes: 0, paidVotes: 0 };
    dayBucket.votes += record.voteCount;
    if (record.voteType === 'FREE') dayBucket.freeVotes += record.voteCount;
    if (record.voteType === 'PAID') dayBucket.paidVotes += record.voteCount;
    daySeriesMap.set(day, dayBucket);

    const hourBucket = hourSeriesMap.get(hour) || { hour, votes: 0 };
    hourBucket.votes += record.voteCount;
    hourSeriesMap.set(hour, hourBucket);

    const growth = nomineeGrowth.get(record.optionId) || { recent: 0, previous: 0 };
    const ageMs = now - record.createdAt.getTime();
    if (ageMs <= 24 * 60 * 60 * 1000) {
      growth.recent += record.voteCount;
    } else if (ageMs <= 48 * 60 * 60 * 1000) {
      growth.previous += record.voteCount;
    }
    nomineeGrowth.set(record.optionId, growth);
  }

  const topNominees = options
    .slice()
    .sort((a, b) => b.totalVotes - a.totalVotes)
    .slice(0, 10)
    .map((option) => {
      const growth = nomineeGrowth.get(option.id) || { recent: 0, previous: 0 };
      return {
        optionId: option.id,
        contestId: option.contestId,
        name: option.name,
        totalVotes: option.totalVotes,
        growthDelta: growth.recent - growth.previous,
      };
    });

  res.json({
    totals: {
      totalVotes,
      uniqueVoters,
      freeVotes,
      paidVotes,
      paidRevenue,
      paidPurchaseCount,
      conversionRate,
      paidIntentConversionRate,
      nominations: nominationTotals,
    },
    perContest: perContestMetrics,
    perNominee: perNomineeMetrics,
    timeSeries: {
      byDay: Array.from(daySeriesMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
      byHour: Array.from(hourSeriesMap.values()).sort((a, b) => a.hour.localeCompare(b.hour)),
    },
    leaderboard: topNominees,
  });
}));

export default router;
