import { createHash, createHmac, randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { sendSMS } from '../services/notifications.js';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { createPaymentIntent } from '../services/paymentCore.js';
import { filterEventGatewaysForOwner, resolveOwnerWalletState } from '../utils/walletPolicy.js';

const router = Router();

const VOTING_SESSION_SECRET =
  process.env.VOTING_SESSION_SECRET || process.env.JWT_SECRET || 'eventpeepo-vote-session-secret';
const EMBED_TOKEN_SECRET =
  process.env.VOTING_EMBED_SECRET || process.env.JWT_SECRET || 'eventpeepo-vote-embed-secret';
const SESSION_TTL_SECONDS = Math.max(300, Number(process.env.VOTING_SESSION_TTL_SECONDS || 86400));
const OTP_TTL_SECONDS = Math.max(60, Number(process.env.VOTING_OTP_TTL_SECONDS || 300));
const EMBED_TOKEN_TTL_SECONDS = Math.max(60, Number(process.env.VOTING_EMBED_TOKEN_TTL_SECONDS || 300));

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

type NominationFieldDefinition = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select';
  required?: boolean;
  placeholder?: string | null;
  options?: string[];
};

const parseNominationFields = (value: string | null | undefined) =>
  parseJson<NominationFieldDefinition[]>(value, [])
    .filter((field) => field && typeof field.id === 'string' && typeof field.label === 'string')
    .map((field) => ({
      ...field,
      id: String(field.id).trim(),
      label: String(field.label).trim(),
      type: (field.type || 'text') as NominationFieldDefinition['type'],
      required: Boolean(field.required),
      placeholder: field.placeholder || null,
      options: Array.isArray(field.options) ? field.options.map((option) => String(option)) : undefined,
    }));

const base64UrlEncode = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url');

const signValue = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

const issueSignedToken = (
  payload: Record<string, unknown>,
  secret: string
) => {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encoded, secret);
  return `${encoded}.${signature}`;
};

const verifySignedToken = <T extends Record<string, unknown>>(
  token: string | undefined | null,
  secret: string
): T | null => {
  const raw = String(token || '').trim();
  if (!raw) return null;
  const [encoded, signature] = raw.split('.');
  if (!encoded || !signature) return null;
  const expected = signValue(encoded, secret);
  if (expected !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
    return payload;
  } catch {
    return null;
  }
};

const hashIp = (ip: string) => createHash('sha256').update(ip).digest('hex');
const hashUa = (ua: string) => createHash('sha256').update(ua).digest('hex');
const hashOtp = (code: string) => createHash('sha256').update(code).digest('hex');
const hashElectionKey = (value: string) => createHash('sha256').update(value).digest('hex');

const normalizeHost = (value: string) =>
  String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const normalizePhone = (phone: string) => phone.replace(/[^\d+]/g, '');

type VoterTokenPayload = {
  eventId: string;
  voterKey: string;
  exp: number;
};

type EmbedTokenPayload = {
  eventId: string;
  slug: string;
  originHost: string;
  exp: number;
};

const resolveEmbedToken = (req: any, explicitToken?: string | null) =>
  String(
    explicitToken ||
      req.get('x-voting-embed-token') ||
      req.query?.embedToken ||
      req.query?.token ||
      ''
  ).trim() || null;

const validateEmbedTokenForEvent = (
  event: { id: string; slug: string },
  token: string | null
) => {
  if (!token) return null;
  const payload = verifySignedToken<EmbedTokenPayload>(token, EMBED_TOKEN_SECRET);
  if (!payload) throw new AppError('Invalid embed token', 401);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSeconds) throw new AppError('Embed token has expired', 401);
  if (payload.eventId !== event.id || payload.slug !== event.slug) {
    throw new AppError('Embed token is not valid for this event', 403);
  }
  return payload;
};

const getOrCreateVoterSession = async (
  eventId: string,
  req: any,
  providedToken?: string | null,
  originHost?: string | null
) => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenPayload = verifySignedToken<VoterTokenPayload>(providedToken, VOTING_SESSION_SECRET);

  if (tokenPayload && tokenPayload.eventId === eventId && tokenPayload.exp > nowSeconds) {
    const existing = await prisma.voterSession.findFirst({
      where: {
        eventId,
        voterKey: tokenPayload.voterKey,
      },
    });
    if (existing) {
      await prisma.voterSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          originHost: originHost || undefined,
        },
      });
      return {
        session: existing,
        token: providedToken || '',
        isNew: false,
      };
    }
  }

  const voterKey = randomUUID();
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
  const userAgent = String(req.get('user-agent') || 'unknown');
  const exp = nowSeconds + SESSION_TTL_SECONDS;
  const token = issueSignedToken(
    {
      eventId,
      voterKey,
      exp,
    },
    VOTING_SESSION_SECRET
  );

  const session = await prisma.voterSession.create({
    data: {
      eventId,
      voterKey,
      ipHash: hashIp(ip),
      userAgentHash: hashUa(userAgent),
      originHost: originHost || null,
      sessionTokenHash: createHash('sha256').update(token).digest('hex'),
    },
  });

  return { session, token, isNew: true };
};

const ensureVotingContext = async (slug: string) => {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      defaultCurrency: true,
      ownerId: true,
      Owner: {
        select: {
          wallets: {
            where: { isActive: true },
            select: {
              id: true,
              walletType: true,
              isActive: true,
              isVerified: true,
              currency: true,
              paystackSubaccount: true,
              paystackRecipientCode: true,
            },
          },
        },
      },
      eventPaymentGateways: {
        where: { isActive: true },
        include: {
          paymentGateway: {
            select: {
              id: true,
              name: true,
              gateway: true,
              currency: true,
            },
          },
        },
        orderBy: { sortOrder: 'asc' },
      },
      votingConfig: true,
      votingContests: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: {
          id: true,
          title: true,
          mode: true,
          allowPublicNominations: true,
          nominationFormFieldsJson: true,
        },
      },
    },
  });
  if (!event) throw new AppError('Event not found', 404);
  if (!event.votingConfig || !event.votingConfig.isEnabled) {
    throw new AppError('Voting is not enabled for this event', 404);
  }
  if (!event.ownerId) throw new AppError('Event owner is not configured', 400);
  const votingConfig = event.votingConfig;
  return {
    ...event,
    votingConfig,
  };
};

router.get('/public/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const event = await ensureVotingContext(slug);
  const embedToken = resolveEmbedToken(req);
  const embedPayload = validateEmbedTokenForEvent(event, embedToken);
  const providedToken = String(req.query.sessionToken || req.get('x-voter-session') || '').trim() || null;
  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    providedToken,
    embedPayload?.originHost || null
  );
  const walletState = resolveOwnerWalletState((event.Owner?.wallets || []) as any[]);
  const visibleGateways = filterEventGatewaysForOwner({
    eventGateways: event.eventPaymentGateways as any[],
    walletState,
  });

  const contestsWithOptions = await prisma.votingContest.findMany({
    where: {
      eventId: event.id,
      isActive: true,
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const contests = contestsWithOptions.map((contest) => ({
    ...contest,
    nominationFormFields: parseNominationFields(contest.nominationFormFieldsJson),
  }));

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
    },
    config: event.votingConfig,
    contests,
    paymentGateways: visibleGateways.map((gateway: any) => ({
      id: gateway.paymentGateway.id,
      name: gateway.paymentGateway.name,
      gateway: gateway.paymentGateway.gateway,
      currency: gateway.paymentGateway.currency,
    })),
    voterSession: {
      id: session.id,
      voterKey: session.voterKey,
      token,
      otpVerified: Boolean(session.otpVerifiedAt),
    },
  });
}));

router.get('/public/:slug/nomination-form', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const event = await ensureVotingContext(slug);

  const nominationEnabled = Boolean(event.votingConfig.allowPublicNominations);
  const contests = event.votingContests
    .filter((contest: any) => contest.allowPublicNominations)
    .map((contest: any) => ({
      id: contest.id,
      title: contest.title,
      mode: contest.mode,
      nominationFormFields: parseNominationFields(contest.nominationFormFieldsJson),
    }));

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
    },
    enabled: nominationEnabled,
    contests,
  });
}));

const submitNominationSchema = z.object({
  contestId: z.string().uuid(),
  nomineeName: z.string().min(2).max(160),
  nomineeDescription: z.string().max(2000).optional().nullable(),
  submitterName: z.string().min(2).max(160),
  submitterEmail: z.string().email().optional().nullable(),
  submitterPhone: z.string().max(40).optional().nullable(),
  customFields: z.record(z.unknown()).optional(),
  sessionToken: z.string().optional(),
  embedToken: z.string().optional(),
});

router.post('/public/:slug/nominations', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const input = submitNominationSchema.parse(req.body || {});
  const event = await ensureVotingContext(slug);
  const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));

  if (!event.votingConfig.allowPublicNominations) {
    throw new AppError('Public nominations are disabled for this event', 400);
  }

  const contest = await prisma.votingContest.findFirst({
    where: {
      id: input.contestId,
      eventId: event.id,
      isActive: true,
    },
    select: {
      id: true,
      title: true,
      allowPublicNominations: true,
      nominationFormFieldsJson: true,
    },
  });
  if (!contest) throw new AppError('Voting contest not found', 404);
  if (!contest.allowPublicNominations) {
    throw new AppError('Public nominations are disabled for this contest', 400);
  }

  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    input.sessionToken,
    embedPayload?.originHost || null
  );

  const definitionList = parseNominationFields(contest.nominationFormFieldsJson);
  const customFields = input.customFields || {};
  const normalizedFields: Record<string, unknown> = {};

  for (const definition of definitionList) {
    const key = definition.id;
    const rawValue = customFields[key];
    const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();

    if (definition.required && !value) {
      throw new AppError(`Custom field "${definition.label}" is required`, 400);
    }
    if (!value) continue;

    if (definition.type === 'email') {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!isValid) throw new AppError(`"${definition.label}" must be a valid email`, 400);
      normalizedFields[key] = value.toLowerCase();
      continue;
    }
    if (definition.type === 'number') {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new AppError(`"${definition.label}" must be numeric`, 400);
      normalizedFields[key] = parsed;
      continue;
    }
    if (definition.type === 'select' && Array.isArray(definition.options) && definition.options.length > 0) {
      if (!definition.options.includes(value)) {
        throw new AppError(`"${definition.label}" has an invalid value`, 400);
      }
      normalizedFields[key] = value;
      continue;
    }
    normalizedFields[key] = value;
  }

  const nomination = await prisma.votingNomination.create({
    data: {
      eventId: event.id,
      contestId: contest.id,
      nomineeName: input.nomineeName.trim(),
      nomineeDescription: input.nomineeDescription?.trim() || null,
      submitterName: input.submitterName.trim(),
      submitterEmail: input.submitterEmail?.trim().toLowerCase() || null,
      submitterPhone: input.submitterPhone ? normalizePhone(input.submitterPhone) : null,
      customFieldsJson: Object.keys(normalizedFields).length ? JSON.stringify(normalizedFields) : null,
      ipHash: session.ipHash,
      userAgentHash: session.userAgentHash,
    },
  });

  res.status(201).json({
    success: true,
    nominationId: nomination.id,
    status: nomination.status,
    voterSessionToken: token,
    message: 'Nomination submitted successfully and is pending review',
  });
}));

const freeVoteSchema = z.object({
  slug: z.string().min(1),
  contestId: z.string().uuid(),
  optionId: z.string().uuid(),
  sessionToken: z.string().optional(),
  embedToken: z.string().optional(),
});

router.post('/free-vote', asyncHandler(async (req, res) => {
  const input = freeVoteSchema.parse(req.body || {});
  const event = await ensureVotingContext(input.slug);
  const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));

  if (!event.votingConfig.allowFreeVotes) {
    throw new AppError('Free voting is disabled for this event', 400);
  }

  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    input.sessionToken,
    embedPayload?.originHost || null
  );
  const contest = await prisma.votingContest.findFirst({
    where: {
      id: input.contestId,
      eventId: event.id,
      isActive: true,
    },
  });
  if (!contest) throw new AppError('Voting contest not found', 404);

  const option = await prisma.votingOption.findFirst({
    where: {
      id: input.optionId,
      contestId: contest.id,
      eventId: event.id,
      isActive: true,
    },
  });
  if (!option) throw new AppError('Voting nominee not found', 404);

  const electionMode = contest.mode === 'ELECTION' || event.votingConfig.mode === 'ELECTION';
  const electionVoterKey = electionMode
    ? session.verifiedPhone
      ? hashElectionKey(session.verifiedPhone)
      : null
    : null;

  if (electionMode && event.votingConfig.requireOtpForElection && !electionVoterKey) {
    throw new AppError('OTP verification is required before voting in election mode', 400);
  }

  await prisma.$transaction(async (tx) => {
    if (electionMode && electionVoterKey) {
      const existingElectionGrant = await tx.voteGrant.findFirst({
        where: {
          eventId: event.id,
          contestId: contest.id,
          electionVoterKey,
        },
      });
      if (existingElectionGrant) {
        throw new AppError('Only one vote is allowed for this election contest', 409);
      }
    }

    await tx.voteGrant.create({
      data: {
        eventId: event.id,
        contestId: contest.id,
        voterKey: session.voterKey,
        electionVoterKey,
        voteType: 'FREE',
        voteCount: 1,
      },
    });

    await tx.voteRecord.create({
      data: {
        eventId: event.id,
        contestId: contest.id,
        optionId: option.id,
        voterKey: session.voterKey,
        voteType: 'FREE',
        voteCount: 1,
      },
    });

    await tx.votingOption.update({
      where: { id: option.id },
      data: {
        freeVotes: { increment: 1 },
        totalVotes: { increment: 1 },
      },
    });
  }).catch((error: any) => {
    if (error instanceof AppError) throw error;
    if (error?.code === 'P2002') {
      throw new AppError('Free vote already recorded for this contest', 409);
    }
    throw error;
  });

  res.status(201).json({
    success: true,
    voterSessionToken: token,
    message: 'Free vote recorded successfully',
  });
}));

const votePaymentIntentSchema = z.object({
  slug: z.string().min(1),
  contestId: z.string().uuid(),
  optionId: z.string().uuid(),
  voteCount: z.number().int().min(1).max(1000),
  paymentGatewayId: z.string().uuid(),
  sessionToken: z.string().optional(),
  embedToken: z.string().optional(),
});

router.post('/payment-intent', asyncHandler(async (req, res) => {
  const input = votePaymentIntentSchema.parse(req.body || {});
  const event = await ensureVotingContext(input.slug);
  const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
  if (!event.votingConfig.allowPaidVotes) {
    throw new AppError('Paid voting is disabled for this event', 400);
  }

  const contest = await prisma.votingContest.findFirst({
    where: {
      id: input.contestId,
      eventId: event.id,
      isActive: true,
    },
  });
  if (!contest) throw new AppError('Voting contest not found', 404);

  const option = await prisma.votingOption.findFirst({
    where: {
      id: input.optionId,
      contestId: contest.id,
      eventId: event.id,
      isActive: true,
    },
  });
  if (!option) throw new AppError('Voting nominee not found', 404);

  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    input.sessionToken,
    embedPayload?.originHost || null
  );
  const electionMode = contest.mode === 'ELECTION' || event.votingConfig.mode === 'ELECTION';
  const electionVoterKey = electionMode
    ? session.verifiedPhone
      ? hashElectionKey(session.verifiedPhone)
      : null
    : null;

  if (electionMode && event.votingConfig.requireOtpForElection && !electionVoterKey) {
    throw new AppError('OTP verification is required before voting in election mode', 400);
  }

  const existingPaidGrant = await prisma.voteGrant.findFirst({
    where: {
      eventId: event.id,
      contestId: contest.id,
      voterKey: session.voterKey,
      voteType: 'PAID',
    },
    select: { id: true },
  });
  if (existingPaidGrant) {
    throw new AppError('Paid vote already recorded for this contest', 409);
  }

  if (electionMode && electionVoterKey) {
    const existingElectionGrant = await prisma.voteGrant.findFirst({
      where: {
        eventId: event.id,
        contestId: contest.id,
        electionVoterKey,
      },
      select: { id: true },
    });
    if (existingElectionGrant) {
      throw new AppError('Only one vote is allowed for this election contest', 409);
    }
  }

  if (input.voteCount > event.votingConfig.maxVotesPerPurchase) {
    throw new AppError(`Maximum ${event.votingConfig.maxVotesPerPurchase} votes per purchase`, 400);
  }

  const baseAmount = Number((event.votingConfig.voteUnitPrice * input.voteCount).toFixed(2));
  if (baseAmount <= 0) throw new AppError('Computed vote amount is invalid', 400);

  const idempotencySeed = JSON.stringify({
    eventId: event.id,
    contestId: contest.id,
    optionId: option.id,
    voterKey: session.voterKey,
    voteCount: input.voteCount,
    gatewayId: input.paymentGatewayId,
  });
  const idempotencyKey =
    String(req.get('Idempotency-Key') || '').trim() ||
    createHash('sha256').update(idempotencySeed).digest('hex');

  const { intent, nextAction } = await createPaymentIntent({
    eventId: event.id,
    purpose: 'VOTE',
    amount: baseAmount,
    currency: event.votingConfig.currency || event.defaultCurrency || 'USD',
    paymentGatewayId: input.paymentGatewayId,
    metadata: {
      contestId: contest.id,
      optionId: option.id,
      voteCount: input.voteCount,
      voterKey: session.voterKey,
      electionVoterKey: electionVoterKey || undefined,
    },
    idempotencyKey,
  });

  res.status(201).json({
    success: true,
    paymentIntentId: intent.id,
    amount: intent.amount,
    currency: intent.currency,
    voterSessionToken: token,
    nextAction,
  });
}));

const otpRequestSchema = z.object({
  slug: z.string().min(1),
  phone: z.string().min(5),
  sessionToken: z.string().optional(),
  embedToken: z.string().optional(),
});

router.post('/otp/request', asyncHandler(async (req, res) => {
  const input = otpRequestSchema.parse(req.body || {});
  const event = await ensureVotingContext(input.slug);
  const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
  if (event.votingConfig.mode !== 'ELECTION' && !event.votingConfig.requireOtpForElection) {
    throw new AppError('OTP is only supported in election mode', 400);
  }

  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    input.sessionToken,
    embedPayload?.originHost || null
  );
  const normalizedPhone = normalizePhone(input.phone);
  if (!normalizedPhone) throw new AppError('Phone number is required for OTP', 400);

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.voterSession.update({
    where: { id: session.id },
    data: {
      verifiedPhone: normalizedPhone,
      otpCodeHash: hashOtp(code),
      otpExpiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      otpVerifiedAt: null,
      lastSeenAt: new Date(),
    },
  });

  const smsResult = await sendSMS(
    normalizedPhone,
    `Your EventPeepo voting OTP is ${code}. It expires in ${Math.ceil(OTP_TTL_SECONDS / 60)} minutes.`
  );
  if (!smsResult?.success) {
    throw new AppError('Failed to send OTP SMS. Please try again later.', 500);
  }

  const maskedPhone = `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-2)}`;
  res.json({
    success: true,
    voterSessionToken: token,
    maskedPhone,
    expiresInSeconds: OTP_TTL_SECONDS,
  });
}));

const otpVerifySchema = z.object({
  slug: z.string().min(1),
  code: z.string().min(4).max(8),
  sessionToken: z.string().optional(),
  embedToken: z.string().optional(),
});

router.post('/otp/verify', asyncHandler(async (req, res) => {
  const input = otpVerifySchema.parse(req.body || {});
  const event = await ensureVotingContext(input.slug);
  const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
  const { session, token } = await getOrCreateVoterSession(
    event.id,
    req,
    input.sessionToken,
    embedPayload?.originHost || null
  );

  if (!session.otpCodeHash || !session.otpExpiresAt) {
    throw new AppError('OTP has not been requested for this session', 400);
  }
  if (session.otpExpiresAt.getTime() < Date.now()) {
    throw new AppError('OTP has expired. Request a new code.', 400);
  }

  const isValid = session.otpCodeHash === hashOtp(input.code);
  if (!isValid) throw new AppError('Invalid OTP code', 400);

  await prisma.voterSession.update({
    where: { id: session.id },
    data: {
      otpVerifiedAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  res.json({
    success: true,
    voterSessionToken: token,
    verified: true,
  });
}));

router.get('/public/:slug/nominees', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const contestId = String(req.query.contestId || '').trim() || null;
  const event = await ensureVotingContext(slug);

  const contests = await prisma.votingContest.findMany({
    where: {
      eventId: event.id,
      isActive: true,
      ...(contestId ? { id: contestId } : {}),
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ totalVotes: 'desc' }, { name: 'asc' }],
        include: {
          approvedNominations: {
            where: { status: 'APPROVED' },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const categories = contests.map((contest) => {
    const totalVotes = contest.options.reduce((sum, option) => sum + option.totalVotes, 0);
    return {
      contestId: contest.id,
      title: contest.title,
      mode: contest.mode,
      totalVotes,
      nominees: contest.options.map((option) => ({
        optionId: option.id,
        name: option.name,
        description: option.description,
        imagePath: option.imagePath,
        totalVotes: option.totalVotes,
        freeVotes: option.freeVotes,
        paidVotes: option.paidVotes,
        voteSharePercent: totalVotes > 0 ? Number(((option.totalVotes / totalVotes) * 100).toFixed(2)) : 0,
        approvalStatus: option.approvedNominations.length > 0 ? 'APPROVED' : 'ADMIN_ADDED',
      })),
    };
  });

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
    },
    categories,
  });
}));

router.get('/public/:slug/leaderboard', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const contestId = String(req.query.contestId || '').trim() || null;
  const event = await ensureVotingContext(slug);

  const contests = await prisma.votingContest.findMany({
    where: {
      eventId: event.id,
      isActive: true,
      ...(contestId ? { id: contestId } : {}),
    },
    include: {
      options: {
        where: { isActive: true },
        orderBy: [{ totalVotes: 'desc' }, { sortOrder: 'asc' }],
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  const now = Date.now();
  const last24h = new Date(now - 24 * 60 * 60 * 1000);
  const prev24h = new Date(now - 48 * 60 * 60 * 1000);
  const recentRecords = await prisma.voteRecord.findMany({
    where: {
      eventId: event.id,
      contestId: contestId || undefined,
      createdAt: { gte: prev24h },
    },
    select: {
      optionId: true,
      voteCount: true,
      createdAt: true,
    },
  });

  const responseContests = contests.map((contest) => {
    const contestTotal = contest.options.reduce((sum, option) => sum + option.totalVotes, 0) || 1;
    const ranked = contest.options.map((option, index) => {
      const recent = recentRecords
        .filter((record) => record.optionId === option.id && record.createdAt >= last24h)
        .reduce((sum, record) => sum + record.voteCount, 0);
      const previous = recentRecords
        .filter((record) => record.optionId === option.id && record.createdAt < last24h)
        .reduce((sum, record) => sum + record.voteCount, 0);
      return {
        optionId: option.id,
        name: option.name,
        imagePath: option.imagePath,
        rank: index + 1,
        totalVotes: option.totalVotes,
        freeVotes: option.freeVotes,
        paidVotes: option.paidVotes,
        voteSharePercent: Number(((option.totalVotes / contestTotal) * 100).toFixed(2)),
        trendDelta: recent - previous,
      };
    });
    return {
      contestId: contest.id,
      title: contest.title,
      mode: contest.mode,
      totals: {
        totalVotes: contest.options.reduce((sum, option) => sum + option.totalVotes, 0),
        freeVotes: contest.options.reduce((sum, option) => sum + option.freeVotes, 0),
        paidVotes: contest.options.reduce((sum, option) => sum + option.paidVotes, 0),
      },
      rankings: ranked,
    };
  });

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
    },
    contests: responseContests,
  });
}));

const embedTokenSchema = z.object({
  slug: z.string().min(1),
});

router.post('/embed/token', asyncHandler(async (req, res) => {
  const input = embedTokenSchema.parse(req.body || {});
  const event = await prisma.event.findUnique({
    where: { slug: input.slug },
    select: {
      id: true,
      slug: true,
      domains: {
        where: {
          status: { in: ['VERIFIED', 'ACTIVE'] },
        },
        select: { host: true },
      },
    },
  });
  if (!event) throw new AppError('Event not found', 404);

  const origin = String(req.get('origin') || req.body?.origin || '').trim();
  if (!origin) throw new AppError('Origin header is required for embed token', 400);
  const originHost = normalizeHost(origin);
  if (!originHost) throw new AppError('Invalid embed origin', 400);

  const allowedHosts = new Set(event.domains.map((domain) => normalizeHost(domain.host)));
  if (!allowedHosts.has(originHost)) {
    throw new AppError('Embed origin is not verified for this event', 403);
  }

  const exp = Math.floor(Date.now() / 1000) + EMBED_TOKEN_TTL_SECONDS;
  const token = issueSignedToken(
    {
      eventId: event.id,
      slug: event.slug,
      originHost,
      exp,
    },
    EMBED_TOKEN_SECRET
  );

  res.json({
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds: EMBED_TOKEN_TTL_SECONDS,
  });
}));

export default router;
