import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';
import { sendEmail } from '../services/notifications.js';
import { getSiteUrl } from '../utils/siteUrl.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

// Owner schema validation
const createOwnerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const updateOwnerSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  isActive: z.boolean().optional(),
});

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
  const data = createOwnerSchema.parse(req.body);
  
  // Check if email already exists
  const existing = await prisma.owner.findUnique({
    where: { email: data.email },
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
              <h1>Welcome to Digital Event Platform</h1>
            </div>
            <div class="content">
              <p>Hello ${owner.name},</p>
              <p>An account has been created for you on the Digital Event Platform. To get started, you'll need to set up your password.</p>
              <p style="text-align: center;">
                <a href="${setupLink}" class="button">Set Up Your Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${setupLink}</p>
              <p>Once you've set up your password, you can log in to manage your events and view your dashboard.</p>
              <p>If you didn't expect this email, please ignore it.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Digital Event Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailText = `
Welcome to Digital Event Platform

Hello ${owner.name},

An account has been created for you on the Digital Event Platform. To get started, you'll need to set up your password.

Visit this link to set up your password:
${setupLink}

Once you've set up your password, you can log in to manage your events and view your dashboard.

If you didn't expect this email, please ignore it.

This is an automated message from Digital Event Platform
    `;
    
    const emailResult = await sendEmail(
      owner.email,
      'Welcome to Digital Event Platform - Set Up Your Password',
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
  const data = updateOwnerSchema.parse(req.body);
  
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  // Check if email is being changed and if it's already in use
  if (data.email && data.email !== owner.email) {
    const existing = await prisma.owner.findUnique({
      where: { email: data.email },
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
    include: { wallet: true },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  res.json({ wallet: owner.wallet || null });
}));

/**
 * POST /api/owners/:id/wallet
 * Create or update owner wallet configuration (admin can set up on behalf of owner)
 */
router.post('/:id/wallet', asyncHandler(async (req, res) => {
  const owner = await prisma.owner.findUnique({
    where: { id: req.params.id },
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
  
  res.json({ wallet, message: 'Wallet configuration saved successfully' });
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
              <h1>Welcome to Digital Event Platform</h1>
            </div>
            <div class="content">
              <p>Hello ${owner.name},</p>
              <p>An account has been created for you on the Digital Event Platform. To get started, you'll need to set up your password.</p>
              <p style="text-align: center;">
                <a href="${setupLink}" class="button">Set Up Your Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #666; font-size: 12px;">${setupLink}</p>
              <p>Once you've set up your password, you can log in to manage your events and view your dashboard.</p>
              <p>If you didn't expect this email, please ignore it.</p>
            </div>
            <div class="footer">
              <p>This is an automated message from Digital Event Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailText = `
Welcome to Digital Event Platform

Hello ${owner.name},

An account has been created for you on the Digital Event Platform. To get started, you'll need to set up your password.

Visit this link to set up your password:
${setupLink}

Once you've set up your password, you can log in to manage your events and view your dashboard.

If you didn't expect this email, please ignore it.

This is an automated message from Digital Event Platform
    `;
    
    const emailResult = await sendEmail(
      owner.email,
      'Welcome to Digital Event Platform - Set Up Your Password',
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
              <p>This is an automated message from Digital Event Platform</p>
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

This is an automated message from Digital Event Platform
    `;
    
    const emailResult = await sendEmail(
      request.owner.email,
      'Password Reset Approved - Digital Event Platform',
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
              <p>This is an automated message from Digital Event Platform</p>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const emailResult = await sendEmail(
      request.owner.email,
      'Password Reset Request Rejected - Digital Event Platform',
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

