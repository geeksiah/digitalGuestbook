import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';
import { sendEmail } from '../services/notifications.js';
import { getSiteUrl } from '../utils/siteUrl.js';
import {
  createPaystackTransferRecipient,
  createPaystackSubaccount,
  getPaystackBanks,
  resolvePaystackAccount,
  updatePaystackSubaccount,
} from '../services/paystack.js';
import {
  resolveOwnerWalletState,
  normalizeWalletType,
  isManualWalletType,
} from '../utils/walletPolicy.js';

const router = Router();

const legacyMethodToWalletType = (preferredMethod?: string | null) => {
  const method = normalizeWalletType(preferredMethod || '');
  if (method === 'stripe') return 'stripe';
  if (method === 'paypal') return 'paypal';
  if (method === 'paystack') return 'paystack';
  return 'manual';
};

// All routes require admin authentication
router.use(authenticateAdmin);

// Owner schema validation
const createOwnerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).default('US'),
});

const updateOwnerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  countryCode: z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional(),
  isActive: z.boolean().optional(),
});

const normalizeEmail = (value: string) => value.trim().toLowerCase();

/**
 * GET /api/owners
 * List all owners
 */
router.get('/', asyncHandler(async (req, res) => {
  const { search, isActive } = req.query;
  
  const where: any = {};
  
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { company: { contains: search as string, mode: 'insensitive' } },
    ];
  }
  
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }
  
  const owners = await prisma.owner.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
  });
  
  const ownersWithCount = owners.map(owner => ({
    ...owner,
    eventCount: owner._count.events,
  }));
  
  res.json({ owners: ownersWithCount });
}));

/**
 * GET /api/owners/:id
 * Get single owner details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    include: {
      events: {
        select: {
          id: true,
          name: true,
          slug: true,
          date: true,
          venue: true,
          isArchived: true,
        },
        orderBy: { date: 'desc' },
      },
      wallet: true,
      _count: {
        select: {
          events: true,
        },
      },
    },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  res.json({ owner });
}));

/**
 * POST /api/owners
 * Create new owner
 */
router.post('/', asyncHandler(async (req, res) => {
  const parsed = createOwnerSchema.parse(req.body);
  const data = {
    ...parsed,
    email: normalizeEmail(parsed.email),
  };
  
  // Check if email already exists
  const existing = await prisma.owner.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
  });
  
  if (existing) {
    throw new AppError('Owner with this email already exists', 400);
  }
  
  const owner = await prisma.owner.create({
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      countryCode: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_CREATED',
      entityType: 'OWNER',
      entityId: owner.id,
      details: JSON.stringify({ name: owner.name, email: owner.email }),
    },
  });
  
  // Send welcome email with password setup link
  try {
    const frontendUrl = getSiteUrl();
    const setupLink = `${frontendUrl}/owner/login`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to EventPeepo</h1>
            </div>
            <div class="content">
              <p>Hello ${owner.name},</p>
              <p>An account has been created for you on the EventPeepo. To get started, you'll need to set up your password.</p>
              <p style="text-align: center;">
                <a href="${setupLink}" class="button">Set Up Your Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${setupLink}</p>
              <p>Once you've set up your password, you can log in to manage your events and view your dashboard.</p>
              <p>If you didn't expect this email, please ignore it.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from EventPeepo</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailText = `
Welcome to EventPeepo

Hello ${owner.name},

An account has been created for you on the EventPeepo. To get started, you'll need to set up your password.

Visit this link to set up your password:
${setupLink}

Once you've set up your password, you can log in to manage your events and view your dashboard.

If you didn't expect this email, please ignore it.

This is an automated message from EventPeepo
    `;
    
    const emailResult = await sendEmail(
      owner.email,
      'Welcome to EventPeepo - Set Up Your Password',
      emailHtml,
      emailText
    );
    if (emailResult.success) {
      console.log(`[Owner Created] Welcome email sent to ${owner.email}`);
    } else {
      console.error('[Owner Created] Failed to send welcome email:', emailResult.error);
    }
  } catch (emailError: any) {
    // Don't fail the request if email fails, just log it
    console.error('[Owner Created] Failed to send welcome email:', emailError.message);
  }
  
  res.status(201).json({ owner });
}));

/**
 * PUT /api/owners/:id
 * Update owner
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const parsed = updateOwnerSchema.parse(req.body);
  const data = {
    ...parsed,
    ...(parsed.email ? { email: normalizeEmail(parsed.email) } : {}),
  };
  
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  // Check if email is being changed and if it's already in use
  if (data.email && data.email !== owner.email) {
    const existing = await prisma.owner.findFirst({
      where: { email: { equals: data.email, mode: 'insensitive' } },
    });
    
    if (existing) {
      throw new AppError('Owner with this email already exists', 400);
    }
  }
  
  const updatedOwner = await prisma.owner.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_UPDATED',
      entityType: 'OWNER',
      entityId: updatedOwner.id,
      details: JSON.stringify(data),
    },
  });
  
  res.json({ owner: updatedOwner });
}));

/**
 * DELETE /api/owners/:id
 * Delete owner (only if no events are associated)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: {
          events: true,
        },
      },
    },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  if (owner._count.events > 0) {
    throw new AppError(
      `Cannot delete owner with ${owner._count.events} associated event(s). Please reassign or delete events first.`,
      400
    );
  }
  
  await prisma.owner.delete({
    where: { id: req.params.id },
  });
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_DELETED',
      entityType: 'OWNER',
      entityId: req.params.id,
      details: JSON.stringify({ name: owner.name, email: owner.email }),
    },
  });
  
  res.json({ message: 'Owner deleted successfully' });
}));

/**
 * GET /api/owners/:id/wallet
 * Get owner wallet configuration
 */
router.get('/:id/wallet', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    include: { wallet: true, wallets: true },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  const walletState = resolveOwnerWalletState((owner.wallets || []) as any[]);
  res.json({
    wallet: owner.wallet || null,
    wallets: owner.wallets || [],
    walletMode: walletState.mode,
  });
}));

/**
 * POST /api/owners/:id/wallet
 * Create or update owner wallet configuration (admin can set up on behalf of owner)
 */
router.post('/:id/wallet', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    include: { wallets: true },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  const walletSchema = z.object({
    // Bank Account Details
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    
    // Mobile Money
    mobileProvider: z.enum(['mpesa', 'mtn', 'airtel']).optional(),
    mobileNumber: z.string().optional(),
    
    // Digital Wallets
    paypalEmail: z.string().email().optional(),
    stripeAccountId: z.string().optional(),
    paystackSubaccount: z.string().optional(),
    
    // Payout Preferences
    preferredMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).default('bank'),
    currency: z.string().default('USD'),
    autoPayoutEnabled: z.boolean().optional(),
    autoPayoutThreshold: z.number().optional(),
  });
  
  const data = walletSchema.parse(req.body);
  
  const wallet = await (prisma as any).ownerWallet.upsert({
    where: { ownerId: req.params.id },
    create: {
      ownerId: req.params.id,
      ...data,
    },
    update: data,
  });
  const walletType = legacyMethodToWalletType(wallet.preferredMethod);
  const activeWallets = (owner.wallets || []).filter((item: any) => item.isActive);
  const activeManual = activeWallets.find((item: any) => isManualWalletType(item.walletType));
  const activeAutomated = activeWallets.filter((item: any) => !isManualWalletType(item.walletType));

  if (isManualWalletType(walletType) && activeAutomated.length > 0) {
    throw new AppError('Disable automated wallets before enabling manual/offline payout mode', 400);
  }
  if (!isManualWalletType(walletType) && activeManual) {
    throw new AppError('Disable manual/offline wallet before enabling automated payout mode', 400);
  }

  const mappedDetails: Record<string, any> = {};
  if (wallet.paypalEmail) mappedDetails.paypalEmail = wallet.paypalEmail;
  if (wallet.stripeAccountId) mappedDetails.stripeAccountId = wallet.stripeAccountId;
  if (wallet.bankName) mappedDetails.bankName = wallet.bankName;
  if (wallet.accountName) mappedDetails.accountName = wallet.accountName;
  if (wallet.accountNumber) mappedDetails.accountNumber = wallet.accountNumber;
  if (wallet.mobileProvider) mappedDetails.mobileProvider = wallet.mobileProvider;
  if (wallet.mobileNumber) mappedDetails.mobileNumber = wallet.mobileNumber;

  const existingByType = activeWallets.find((item: any) => normalizeWalletType(item.walletType) === walletType);
  if (existingByType) {
    await (prisma as any).ownerPayoutWallet.update({
      where: { id: existingByType.id },
      data: {
        walletType,
        currency: wallet.currency || 'USD',
        countryCode: owner.countryCode || null,
        isActive: true,
        isVerified: Boolean(wallet.isVerified),
        verifiedAt: wallet.isVerified ? new Date() : null,
        providerAccountId: wallet.stripeAccountId || null,
        paystackSubaccount: wallet.paystackSubaccount || null,
        paystackRecipientCode: (wallet as any).paystackRecipientCode || null,
        detailsJson: Object.keys(mappedDetails).length > 0 ? JSON.stringify(mappedDetails) : null,
      },
    });
  } else {
    await (prisma as any).ownerPayoutWallet.create({
      data: {
        ownerId: owner.id,
        walletType,
        currency: wallet.currency || 'USD',
        countryCode: owner.countryCode || null,
        isActive: true,
        isVerified: Boolean(wallet.isVerified),
        verifiedAt: wallet.isVerified ? new Date() : null,
        providerAccountId: wallet.stripeAccountId || null,
        paystackSubaccount: wallet.paystackSubaccount || null,
        paystackRecipientCode: (wallet as any).paystackRecipientCode || null,
        detailsJson: Object.keys(mappedDetails).length > 0 ? JSON.stringify(mappedDetails) : null,
      },
    });
  }
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_WALLET_UPDATED',
      entityType: 'OWNER',
      entityId: owner.id,
      details: JSON.stringify({ walletId: wallet.id, preferredMethod: wallet.preferredMethod }),
    },
  });
  
  const latest = await prisma.owner.findUnique({
    where: { id: owner.id },
    include: { wallet: true, wallets: true },
  });
  const walletState = resolveOwnerWalletState((latest?.wallets || []) as any[]);

  res.json({
    wallet: latest?.wallet || wallet,
    wallets: latest?.wallets || [],
    walletMode: walletState.mode,
    message: 'Wallet configuration saved successfully',
  });
}));

/**
 * GET /api/owners/:id/wallet/paystack/banks
 * List Paystack banks for admin-assisted owner wallet setup
 */
router.get('/:id/wallet/paystack/banks', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({ where: { id: req.params.id } });
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const country = String(req.query.country || 'ghana').trim().toLowerCase();
  const currency = String(req.query.currency || '').trim().toUpperCase() || undefined;
  const banks = await getPaystackBanks({ country, currency });

  res.json({ banks });
}));

/**
 * POST /api/owners/:id/wallet/paystack/connect
 * Admin-assisted Paystack subaccount setup for owner automated split payouts
 */
router.post('/:id/wallet/paystack/connect', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    include: { wallet: true, wallets: true },
  });

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  const connectSchema = z.object({
    bankCode: z.string().min(2),
    accountNumber: z.string().min(6),
    businessName: z.string().optional(),
    currency: z.string().optional(),
    country: z.string().optional(),
    setAsPreferred: z.boolean().optional(),
    percentageCharge: z.number().min(0).max(100).optional(),
  });

  const input = connectSchema.parse(req.body);
  const ownerCountryCode = (input.country || owner.countryCode || '').trim().toUpperCase();
  if (!ownerCountryCode) {
    throw new AppError('Owner country is required before connecting Paystack', 400);
  }
  const state = resolveOwnerWalletState((owner.wallets || []) as any[]);
  if (state.manualWallet) {
    throw new AppError('Disable manual/offline wallet before connecting Paystack', 400);
  }

  const accountNumber = input.accountNumber.replace(/\s+/g, '');
  const bankCode = input.bankCode.trim();
  const businessName =
    input.businessName?.trim() ||
    owner.company?.trim() ||
    owner.name?.trim() ||
    owner.email;

  const resolvedAccount = await resolvePaystackAccount(accountNumber, bankCode);
  const payload = {
    businessName,
    bankCode,
    accountNumber,
    percentageCharge: input.percentageCharge ?? 0,
    primaryContactName: owner.name,
    primaryContactEmail: owner.email,
    description: `EventPeepo owner payout destination (${owner.id})`,
  };

  const existingPaystackWallet = (owner.wallets || []).find((wallet: any) =>
    wallet.isActive && normalizeWalletType(wallet.walletType) === 'paystack'
  );
  let paystackSubaccount =
    existingPaystackWallet?.paystackSubaccount || owner.wallet?.paystackSubaccount || undefined;
  let paystackRecipientCode =
    existingPaystackWallet?.paystackRecipientCode || (owner.wallet as any)?.paystackRecipientCode || undefined;
  const walletCurrency =
    (input.currency || existingPaystackWallet?.currency || owner.wallet?.currency || 'NGN').toUpperCase();

  if (paystackSubaccount) {
    try {
      const updated = await updatePaystackSubaccount(paystackSubaccount, payload);
      paystackSubaccount = updated.subaccount_code || paystackSubaccount;
    } catch {
      const created = await createPaystackSubaccount(payload);
      paystackSubaccount = created.subaccount_code;
    }
  } else {
    const created = await createPaystackSubaccount(payload);
    paystackSubaccount = created.subaccount_code;
  }

  try {
    const recipient = await createPaystackTransferRecipient({
      name: resolvedAccount.account_name || businessName,
      accountNumber,
      bankCode,
      currency: walletCurrency,
      type: 'nuban',
      description: `EventPeepo owner transfer recipient (${owner.id})`,
    });
    paystackRecipientCode = recipient.recipient_code;
  } catch (error) {
    if (!paystackRecipientCode) {
      throw error;
    }
  }

  const wallet = await (prisma as any).ownerWallet.upsert({
    where: { ownerId: owner.id },
    create: {
      ownerId: owner.id,
      bankName: resolvedAccount.bank_name || owner.wallet?.bankName || null,
      accountName: resolvedAccount.account_name,
      accountNumber,
      routingNumber: bankCode,
      paystackSubaccount,
      paystackRecipientCode,
      paystackRecipientType: 'nuban',
      paystackRecipientName: resolvedAccount.account_name,
      paystackRecipientBankCode: bankCode,
      paystackRecipientUpdatedAt: new Date(),
      preferredMethod: input.setAsPreferred === false ? (owner.wallet?.preferredMethod || 'bank') : 'paystack',
      currency: walletCurrency,
      isVerified: true,
      verifiedAt: new Date(),
    },
    update: {
      bankName: resolvedAccount.bank_name || owner.wallet?.bankName || undefined,
      accountName: resolvedAccount.account_name,
      accountNumber,
      routingNumber: bankCode,
      paystackSubaccount,
      paystackRecipientCode,
      paystackRecipientType: 'nuban',
      paystackRecipientName: resolvedAccount.account_name,
      paystackRecipientBankCode: bankCode,
      paystackRecipientUpdatedAt: new Date(),
      preferredMethod: input.setAsPreferred === false ? undefined : 'paystack',
      currency: walletCurrency,
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  const payoutWallet = existingPaystackWallet
    ? await (prisma as any).ownerPayoutWallet.update({
        where: { id: existingPaystackWallet.id },
        data: {
          walletType: 'paystack',
          currency: walletCurrency,
          countryCode: ownerCountryCode,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
          paystackSubaccount,
          paystackRecipientCode,
          detailsJson: JSON.stringify({
            bankCode,
            bankName: resolvedAccount.bank_name || null,
            accountName: resolvedAccount.account_name || null,
            accountNumber: resolvedAccount.account_number || accountNumber,
          }),
        },
      })
    : await (prisma as any).ownerPayoutWallet.create({
        data: {
          ownerId: owner.id,
          walletType: 'paystack',
          currency: walletCurrency,
          countryCode: ownerCountryCode,
          isActive: true,
          isVerified: true,
          verifiedAt: new Date(),
          paystackSubaccount: paystackSubaccount || null,
          paystackRecipientCode: paystackRecipientCode || null,
          detailsJson: JSON.stringify({
            bankCode,
            bankName: resolvedAccount.bank_name || null,
            accountName: resolvedAccount.account_name || null,
            accountNumber: resolvedAccount.account_number || accountNumber,
          }),
        },
      });

  await prisma.owner.update({
    where: { id: owner.id },
    data: { countryCode: ownerCountryCode },
  });

  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_PAYSTACK_CONNECTED_BY_ADMIN',
      entityType: 'OWNER_WALLET',
      entityId: payoutWallet.id,
      details: JSON.stringify({
        ownerId: owner.id,
        bankCode,
        country: ownerCountryCode,
        currency: walletCurrency,
        paystackSubaccount,
        paystackRecipientCode,
      }),
    },
  });

  const latest = await prisma.owner.findUnique({
    where: { id: owner.id },
    include: { wallet: true, wallets: true },
  });
  const walletState = resolveOwnerWalletState((latest?.wallets || []) as any[]);

  res.json({
    wallet: latest?.wallet || wallet,
    wallets: latest?.wallets || [],
    walletMode: walletState.mode,
    payoutWallet,
    paystack: {
      subaccountCode: paystackSubaccount,
      recipientCode: paystackRecipientCode,
      accountName: resolvedAccount.account_name,
      accountNumber: resolvedAccount.account_number,
    },
    message: 'Owner Paystack account connected successfully',
  });
}));

/**
 * POST /api/owners/:id/change-password
 * Admin changes owner password directly
 */
router.post('/:id/change-password', asyncHandler(async (req, res) => {
  const { newPassword } = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }).parse(req.body);

  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
  });

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password
  await prisma.owner.update({
    where: { id: owner.id },
    data: { passwordHash },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_PASSWORD_CHANGED',
      entityType: 'OWNER',
      entityId: owner.id,
      details: JSON.stringify({ email: owner.email }),
    },
  });

  res.json({ message: 'Password changed successfully' });
}));

/**
 * POST /api/owners/:id/resend-welcome-email
 * Admin resends password creation email to owner
 * NOTE: This route must be defined BEFORE router.put('/:id') to avoid route conflicts
 */
router.post('/:id/resend-welcome-email', asyncHandler(async (req, res) => {
  console.log('[Resend Welcome Email] Route hit for owner ID:', req.params.id);
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  // Send welcome email with password setup link
  try {
    const frontendUrl = getSiteUrl();
    const setupLink = `${frontendUrl}/owner/login`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to EventPeepo</h1>
            </div>
            <div class="content">
              <p>Hello ${owner.name},</p>
              <p>An account has been created for you on the EventPeepo. To get started, you'll need to set up your password.</p>
              <p style="text-align: center;">
                <a href="${setupLink}" class="button">Set Up Your Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${setupLink}</p>
              <p>Once you've set up your password, you can log in to manage your events and view your dashboard.</p>
              <p>If you didn't expect this email, please ignore it.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from EventPeepo</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailText = `
Welcome to EventPeepo

Hello ${owner.name},

An account has been created for you on the EventPeepo. To get started, you'll need to set up your password.

Visit this link to set up your password:
${setupLink}

Once you've set up your password, you can log in to manage your events and view your dashboard.

If you didn't expect this email, please ignore it.

This is an automated message from EventPeepo
    `;
    
    const emailResult = await sendEmail(
      owner.email,
      'Welcome to EventPeepo - Set Up Your Password',
      emailHtml,
      emailText
    );
    if (emailResult.success) {
      console.log(`[Owner] Welcome email resent to ${owner.email}`);
    } else {
      console.error('[Owner] Failed to resend welcome email:', emailResult.error);
      throw new AppError(`Failed to send email: ${emailResult.error}`, 500);
    }
  } catch (emailError: any) {
    console.error('[Owner] Email error:', emailError);
    throw new AppError(`Failed to send email: ${emailError.message}`, 500);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'OWNER_WELCOME_EMAIL_RESENT',
      entityType: 'OWNER',
      entityId: owner.id,
      details: JSON.stringify({ email: owner.email }),
    },
  });

  res.json({ message: 'Welcome email sent successfully' });
}));

/**
 * GET /api/owners/password-reset-requests
 * Get all pending password reset requests
 */
router.get('/password-reset-requests', asyncHandler(async (req, res) => {
  const { status } = req.query;

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const requests = await prisma.passwordResetRequest.findMany({
    where,
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      admin: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ requests });
}));

/**
 * POST /api/owners/password-reset-requests/:id/approve
 * Admin approves password reset request
 */
router.post('/password-reset-requests/:id/approve', asyncHandler(async (req, res) => {
  const { newPassword } = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }).parse(req.body);

  const request = await prisma.passwordResetRequest.findUnique({
    where: { id: req.params.id },
    include: { owner: true },
  });

  if (!request) {
    throw new AppError('Password reset request not found', 404);
  }

  if (request.status !== 'PENDING') {
    throw new AppError(`Request is already ${request.status.toLowerCase()}`, 400);
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update owner password
  await prisma.owner.update({
    where: { id: request.ownerId },
    data: { passwordHash },
  });

  // Update request status
  await prisma.passwordResetRequest.update({
    where: { id: request.id },
    data: {
      status: 'APPROVED',
      approvedBy: req.admin!.id,
      newPasswordHash: passwordHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  // Send notification email to owner
  try {
    const frontendUrl = getSiteUrl();
    const loginLink = `${frontendUrl}/owner/login`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; background: #1a1a2e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Approved</h1>
            </div>
            <div class="content">
              <p>Hello ${request.owner.name},</p>
              <p>Your password reset request has been approved by an administrator. Your password has been changed.</p>
              <p style="text-align: center;">
                <a href="${loginLink}" class="button">Log In Now</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${loginLink}</p>
              <p>If you didn't request this password reset, please contact support immediately.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from EventPeepo</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailText = `
Password Reset Approved

Hello ${request.owner.name},

Your password reset request has been approved by an administrator. Your password has been changed.

Visit this link to log in:
${loginLink}

If you didn't request this password reset, please contact support immediately.

This is an automated message from EventPeepo
    `;
    
    const emailResult = await sendEmail(
      request.owner.email,
      'Password Reset Approved - EventPeepo',
      emailHtml,
      emailText
    );
    if (emailResult.success) {
      console.log('[Password Reset] Approval email sent to:', request.owner.email);
    } else {
      console.error('[Password Reset] Failed to send approval email:', emailResult.error);
    }
  } catch (emailError: any) {
    console.error('[Password Reset] Failed to send approval email:', emailError.message);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'PASSWORD_RESET_APPROVED',
      entityType: 'OWNER',
      entityId: request.ownerId,
      details: JSON.stringify({ requestId: request.id, email: request.owner.email }),
    },
  });

  res.json({ message: 'Password reset approved and owner notified' });
}));

/**
 * POST /api/owners/password-reset-requests/:id/reject
 * Admin rejects password reset request
 */
router.post('/password-reset-requests/:id/reject', asyncHandler(async (req, res) => {
  const { reason } = z.object({
    reason: z.string().optional(),
  }).parse(req.body);

  const request = await prisma.passwordResetRequest.findUnique({
    where: { id: req.params.id },
    include: { owner: true },
  });

  if (!request) {
    throw new AppError('Password reset request not found', 404);
  }

  if (request.status !== 'PENDING') {
    throw new AppError(`Request is already ${request.status.toLowerCase()}`, 400);
  }

  // Update request status
  await prisma.passwordResetRequest.update({
    where: { id: request.id },
    data: {
      status: 'REJECTED',
      approvedBy: req.admin!.id,
      rejectedReason: reason || null,
    },
  });

  // Send notification email to owner (optional)
  try {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request Rejected</h1>
            </div>
            <div class="content">
              <p>Hello ${request.owner.name},</p>
              <p>Your password reset request has been reviewed and rejected by an administrator.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>If you believe this is an error, please contact support for assistance.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from EventPeepo</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailResult = await sendEmail(
      request.owner.email,
      'Password Reset Request Rejected - EventPeepo',
      emailHtml,
      `Your password reset request has been rejected.${reason ? ` Reason: ${reason}` : ''}`
    );
    if (emailResult.success) {
      console.log('[Password Reset] Rejection email sent to:', request.owner.email);
    } else {
      console.error('[Password Reset] Failed to send rejection email:', emailResult.error);
    }
  } catch (emailError: any) {
    console.error('[Password Reset] Failed to send rejection email:', emailError.message);
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'PASSWORD_RESET_REJECTED',
      entityType: 'OWNER',
      entityId: request.ownerId,
      details: JSON.stringify({ requestId: request.id, reason: reason || null }),
    },
  });

  res.json({ message: 'Password reset request rejected' });
}));

export default router;

