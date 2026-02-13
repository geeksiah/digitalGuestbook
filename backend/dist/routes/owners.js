"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const zod_1 = require("zod");
const notifications_js_1 = require("../services/notifications.js");
const siteUrl_js_1 = require("../utils/siteUrl.js");
const paystack_js_1 = require("../services/paystack.js");
const router = (0, express_1.Router)();
// All routes require admin authentication
router.use(auth_js_1.authenticateAdmin);
// Owner schema validation
const createOwnerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required'),
    email: zod_1.z.string().email('Valid email is required'),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
});
const updateOwnerSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
/**
 * GET /api/owners
 * List all owners
 */
router.get('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { search, isActive } = req.query;
    const where = {};
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { company: { contains: search, mode: 'insensitive' } },
        ];
    }
    if (isActive !== undefined) {
        where.isActive = isActive === 'true';
    }
    const owners = await prisma_js_1.default.owner.findMany({
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
router.get('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({
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
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    res.json({ owner });
}));
/**
 * POST /api/owners
 * Create new owner
 */
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = createOwnerSchema.parse(req.body);
    // Check if email already exists
    const existing = await prisma_js_1.default.owner.findUnique({
        where: { email: data.email },
    });
    if (existing) {
        throw new errorHandler_js_1.AppError('Owner with this email already exists', 400);
    }
    const owner = await prisma_js_1.default.owner.create({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            action: 'OWNER_CREATED',
            entityType: 'OWNER',
            entityId: owner.id,
            details: JSON.stringify({ name: owner.name, email: owner.email }),
        },
    });
    // Send welcome email with password setup link
    try {
        const frontendUrl = (0, siteUrl_js_1.getSiteUrl)();
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
        const emailResult = await (0, notifications_js_1.sendEmail)(owner.email, 'Welcome to EventPeepo - Set Up Your Password', emailHtml, emailText);
        if (emailResult.success) {
            console.log(`[Owner Created] Welcome email sent to ${owner.email}`);
        }
        else {
            console.error('[Owner Created] Failed to send welcome email:', emailResult.error);
        }
    }
    catch (emailError) {
        // Don't fail the request if email fails, just log it
        console.error('[Owner Created] Failed to send welcome email:', emailError.message);
    }
    res.status(201).json({ owner });
}));
/**
 * PUT /api/owners/:id
 * Update owner
 */
router.put('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = updateOwnerSchema.parse(req.body);
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== owner.email) {
        const existing = await prisma_js_1.default.owner.findUnique({
            where: { email: data.email },
        });
        if (existing) {
            throw new errorHandler_js_1.AppError('Owner with this email already exists', 400);
        }
    }
    const updatedOwner = await prisma_js_1.default.owner.update({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.delete('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({
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
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    if (owner._count.events > 0) {
        throw new errorHandler_js_1.AppError(`Cannot delete owner with ${owner._count.events} associated event(s). Please reassign or delete events first.`, 400);
    }
    await prisma_js_1.default.owner.delete({
        where: { id: req.params.id },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.get('/:id/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
        include: { wallet: true },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    res.json({ wallet: owner.wallet || null });
}));
/**
 * POST /api/owners/:id/wallet
 * Create or update owner wallet configuration (admin can set up on behalf of owner)
 */
router.post('/:id/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const walletSchema = zod_1.z.object({
        // Bank Account Details
        bankName: zod_1.z.string().optional(),
        accountName: zod_1.z.string().optional(),
        accountNumber: zod_1.z.string().optional(),
        routingNumber: zod_1.z.string().optional(),
        swiftCode: zod_1.z.string().optional(),
        // Mobile Money
        mobileProvider: zod_1.z.enum(['mpesa', 'mtn', 'airtel']).optional(),
        mobileNumber: zod_1.z.string().optional(),
        // Digital Wallets
        paypalEmail: zod_1.z.string().email().optional(),
        stripeAccountId: zod_1.z.string().optional(),
        paystackSubaccount: zod_1.z.string().optional(),
        // Payout Preferences
        preferredMethod: zod_1.z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).default('bank'),
        currency: zod_1.z.string().default('USD'),
        autoPayoutEnabled: zod_1.z.boolean().optional(),
        autoPayoutThreshold: zod_1.z.number().optional(),
    });
    const data = walletSchema.parse(req.body);
    const wallet = await prisma_js_1.default.ownerWallet.upsert({
        where: { ownerId: req.params.id },
        create: {
            ownerId: req.params.id,
            ...data,
        },
        update: data,
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            action: 'OWNER_WALLET_UPDATED',
            entityType: 'OWNER',
            entityId: owner.id,
            details: JSON.stringify({ walletId: wallet.id, preferredMethod: wallet.preferredMethod }),
        },
    });
    res.json({ wallet, message: 'Wallet configuration saved successfully' });
}));
/**
 * GET /api/owners/:id/wallet/paystack/banks
 * List Paystack banks for admin-assisted owner wallet setup
 */
router.get('/:id/wallet/paystack/banks', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({ where: { id: req.params.id } });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const country = String(req.query.country || 'ghana').trim().toLowerCase();
    const currency = String(req.query.currency || '').trim().toUpperCase() || undefined;
    const banks = await (0, paystack_js_1.getPaystackBanks)({ country, currency });
    res.json({ banks });
}));
/**
 * POST /api/owners/:id/wallet/paystack/connect
 * Admin-assisted Paystack subaccount setup for owner automated split payouts
 */
router.post('/:id/wallet/paystack/connect', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
        include: { wallet: true },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const connectSchema = zod_1.z.object({
        bankCode: zod_1.z.string().min(2),
        accountNumber: zod_1.z.string().min(6),
        businessName: zod_1.z.string().optional(),
        currency: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        setAsPreferred: zod_1.z.boolean().optional(),
        percentageCharge: zod_1.z.number().min(0).max(100).optional(),
    });
    const input = connectSchema.parse(req.body);
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const bankCode = input.bankCode.trim();
    const businessName = input.businessName?.trim() ||
        owner.company?.trim() ||
        owner.name?.trim() ||
        owner.email;
    const resolvedAccount = await (0, paystack_js_1.resolvePaystackAccount)(accountNumber, bankCode);
    const payload = {
        businessName,
        bankCode,
        accountNumber,
        percentageCharge: input.percentageCharge ?? 0,
        primaryContactName: owner.name,
        primaryContactEmail: owner.email,
        description: `EventPeepo owner payout destination (${owner.id})`,
    };
    let paystackSubaccount = owner.wallet?.paystackSubaccount || undefined;
    if (paystackSubaccount) {
        try {
            const updated = await (0, paystack_js_1.updatePaystackSubaccount)(paystackSubaccount, payload);
            paystackSubaccount = updated.subaccount_code || paystackSubaccount;
        }
        catch {
            const created = await (0, paystack_js_1.createPaystackSubaccount)(payload);
            paystackSubaccount = created.subaccount_code;
        }
    }
    else {
        const created = await (0, paystack_js_1.createPaystackSubaccount)(payload);
        paystackSubaccount = created.subaccount_code;
    }
    const wallet = await prisma_js_1.default.ownerWallet.upsert({
        where: { ownerId: owner.id },
        create: {
            ownerId: owner.id,
            bankName: resolvedAccount.bank_name || owner.wallet?.bankName || null,
            accountName: resolvedAccount.account_name,
            accountNumber,
            paystackSubaccount,
            preferredMethod: input.setAsPreferred === false ? (owner.wallet?.preferredMethod || 'bank') : 'paystack',
            currency: input.currency || owner.wallet?.currency || 'NGN',
            isVerified: true,
            verifiedAt: new Date(),
        },
        update: {
            bankName: resolvedAccount.bank_name || owner.wallet?.bankName || undefined,
            accountName: resolvedAccount.account_name,
            accountNumber,
            paystackSubaccount,
            preferredMethod: input.setAsPreferred === false ? undefined : 'paystack',
            currency: input.currency || undefined,
            isVerified: true,
            verifiedAt: new Date(),
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            action: 'OWNER_PAYSTACK_CONNECTED_BY_ADMIN',
            entityType: 'OWNER_WALLET',
            entityId: wallet.id,
            details: JSON.stringify({
                ownerId: owner.id,
                bankCode,
                country: input.country || null,
                currency: wallet.currency,
                paystackSubaccount,
            }),
        },
    });
    res.json({
        wallet,
        paystack: {
            subaccountCode: paystackSubaccount,
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
router.post('/:id/change-password', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { newPassword } = zod_1.z.object({
        newPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    }).parse(req.body);
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    // Hash new password
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
    // Update password
    await prisma_js_1.default.owner.update({
        where: { id: owner.id },
        data: { passwordHash },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.post('/:id/resend-welcome-email', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    console.log('[Resend Welcome Email] Route hit for owner ID:', req.params.id);
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: req.params.id },
        select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true,
        },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    // Send welcome email with password setup link
    try {
        const frontendUrl = (0, siteUrl_js_1.getSiteUrl)();
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
        const emailResult = await (0, notifications_js_1.sendEmail)(owner.email, 'Welcome to EventPeepo - Set Up Your Password', emailHtml, emailText);
        if (emailResult.success) {
            console.log(`[Owner] Welcome email resent to ${owner.email}`);
        }
        else {
            console.error('[Owner] Failed to resend welcome email:', emailResult.error);
            throw new errorHandler_js_1.AppError(`Failed to send email: ${emailResult.error}`, 500);
        }
    }
    catch (emailError) {
        console.error('[Owner] Email error:', emailError);
        throw new errorHandler_js_1.AppError(`Failed to send email: ${emailError.message}`, 500);
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.get('/password-reset-requests', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { status } = req.query;
    const where = {};
    if (status) {
        where.status = status;
    }
    const requests = await prisma_js_1.default.passwordResetRequest.findMany({
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
router.post('/password-reset-requests/:id/approve', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { newPassword } = zod_1.z.object({
        newPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    }).parse(req.body);
    const request = await prisma_js_1.default.passwordResetRequest.findUnique({
        where: { id: req.params.id },
        include: { owner: true },
    });
    if (!request) {
        throw new errorHandler_js_1.AppError('Password reset request not found', 404);
    }
    if (request.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError(`Request is already ${request.status.toLowerCase()}`, 400);
    }
    // Hash new password
    const passwordHash = await bcryptjs_1.default.hash(newPassword, 12);
    // Update owner password
    await prisma_js_1.default.owner.update({
        where: { id: request.ownerId },
        data: { passwordHash },
    });
    // Update request status
    await prisma_js_1.default.passwordResetRequest.update({
        where: { id: request.id },
        data: {
            status: 'APPROVED',
            approvedBy: req.admin.id,
            newPasswordHash: passwordHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
    });
    // Send notification email to owner
    try {
        const frontendUrl = (0, siteUrl_js_1.getSiteUrl)();
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
        const emailResult = await (0, notifications_js_1.sendEmail)(request.owner.email, 'Password Reset Approved - EventPeepo', emailHtml, emailText);
        if (emailResult.success) {
            console.log('[Password Reset] Approval email sent to:', request.owner.email);
        }
        else {
            console.error('[Password Reset] Failed to send approval email:', emailResult.error);
        }
    }
    catch (emailError) {
        console.error('[Password Reset] Failed to send approval email:', emailError.message);
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.post('/password-reset-requests/:id/reject', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { reason } = zod_1.z.object({
        reason: zod_1.z.string().optional(),
    }).parse(req.body);
    const request = await prisma_js_1.default.passwordResetRequest.findUnique({
        where: { id: req.params.id },
        include: { owner: true },
    });
    if (!request) {
        throw new errorHandler_js_1.AppError('Password reset request not found', 404);
    }
    if (request.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError(`Request is already ${request.status.toLowerCase()}`, 400);
    }
    // Update request status
    await prisma_js_1.default.passwordResetRequest.update({
        where: { id: request.id },
        data: {
            status: 'REJECTED',
            approvedBy: req.admin.id,
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
        const emailResult = await (0, notifications_js_1.sendEmail)(request.owner.email, 'Password Reset Request Rejected - EventPeepo', emailHtml, `Your password reset request has been rejected.${reason ? ` Reason: ${reason}` : ''}`);
        if (emailResult.success) {
            console.log('[Password Reset] Rejection email sent to:', request.owner.email);
        }
        else {
            console.error('[Password Reset] Failed to send rejection email:', emailResult.error);
        }
    }
    catch (emailError) {
        console.error('[Password Reset] Failed to send rejection email:', emailError.message);
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            action: 'PASSWORD_RESET_REJECTED',
            entityType: 'OWNER',
            entityId: request.ownerId,
            details: JSON.stringify({ requestId: request.id, reason: reason || null }),
        },
    });
    res.json({ message: 'Password reset request rejected' });
}));
exports.default = router;
//# sourceMappingURL=owners.js.map