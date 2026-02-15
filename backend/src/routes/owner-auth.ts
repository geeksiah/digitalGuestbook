import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const setupPasswordSchema = z.object({
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

const requestPasswordResetSchema = z.object({
  email: z.string().email('Valid email is required'),
  reason: z.string().optional(),
});

// Get JWT secret
const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'fallback-secret') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Owner Auth] CRITICAL: JWT_SECRET not set in production!');
      throw new Error('JWT_SECRET must be set in production');
    }
    return 'development-fallback-secret-change-in-production';
  }
  return secret;
};

/**
 * POST /api/owner-auth/register
 * Register new owner account
 */
router.post('/register', asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  // Check if email already exists
  const existing = await prisma.owner.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new AppError('Email already registered', 400);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Create owner
  const owner = await prisma.owner.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone,
      company: data.company,
      emailVerified: false, // Email verification can be added later
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Generate JWT token
  const jwtSecret = getJwtSecret();
  const expiresIn = 2592000; // 30 days
  const token = jwt.sign(
    { ownerId: owner.id },
    jwtSecret,
    { expiresIn }
  );

  // Update last login
  await prisma.owner.update({
    where: { id: owner.id },
    data: { lastLoginAt: new Date() },
  });

  res.status(201).json({
    token,
    owner,
  });
}));

/**
 * POST /api/owner-auth/login
 * Owner login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  const owner = await prisma.owner.findUnique({
    where: { email: data.email },
  });

  if (!owner) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if owner has password set (admin-created owners might not have passwords)
  if (!owner.passwordHash) {
    throw new AppError('Account was created by admin. Please contact support to set up your password.', 401);
  }

  // Verify password
  const validPassword = await bcrypt.compare(data.password, owner.passwordHash);

  if (!validPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Check if account is active
  if (!owner.isActive) {
    throw new AppError('Account is inactive. Please contact support.', 403);
  }

  // Generate JWT token
  const jwtSecret = getJwtSecret();
  const expiresIn = 2592000; // 30 days
  const token = jwt.sign(
    { ownerId: owner.id },
    jwtSecret,
    { expiresIn }
  );

  // Update last login
  await prisma.owner.update({
    where: { id: owner.id },
    data: { lastLoginAt: new Date() },
  });

  res.json({
    token,
    owner: {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      phone: owner.phone,
      company: owner.company,
      isActive: owner.isActive,
    },
  });
}));

/**
 * GET /api/owner-auth/me
 * Get current owner profile
 */
router.get('/me', authenticateOwnerAccount, asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      lastLoginAt: true,
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
 * POST /api/owner-auth/setup-password
 * Set initial password for admin-created owner accounts
 */
router.post('/setup-password', asyncHandler(async (req, res) => {
  const data = setupPasswordSchema.parse(req.body);

  const owner = await prisma.owner.findUnique({
    where: { email: data.email },
  });

  if (!owner) {
    throw new AppError('Owner account not found', 404);
  }

  // Check if password is already set
  if (owner.passwordHash) {
    throw new AppError('Password is already set. Use change-password endpoint instead.', 400);
  }

  // Check if account is active
  if (!owner.isActive) {
    throw new AppError('Account is inactive. Please contact support.', 403);
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(data.password, 12);

  // Update password
  await prisma.owner.update({
    where: { id: owner.id },
    data: { passwordHash },
  });

  // Generate JWT token and return it (auto-login after setup)
  const jwtSecret = getJwtSecret();
  const expiresIn = 2592000; // 30 days
  const token = jwt.sign(
    { ownerId: owner.id },
    jwtSecret,
    { expiresIn }
  );

  // Update last login
  await prisma.owner.update({
    where: { id: owner.id },
    data: { lastLoginAt: new Date() },
  });

  const ownerResponse = {
    id: owner.id,
    name: owner.name,
    email: owner.email,
    phone: owner.phone,
    company: owner.company,
    isActive: owner.isActive,
    createdAt: owner.createdAt,
  };

  res.json({
    token,
    owner: ownerResponse,
    message: 'Password set successfully',
  });
}));

/**
 * POST /api/owner-auth/request-password-reset
 * Submit a password reset request for admin review
 */
router.post('/request-password-reset', asyncHandler(async (req, res) => {
  const data = requestPasswordResetSchema.parse(req.body);

  const owner = await prisma.owner.findUnique({
    where: { email: data.email },
  });

  if (!owner) {
    throw new AppError('Owner account not found', 404);
  }

  if (!owner.isActive) {
    throw new AppError('Account is inactive. Please contact support.', 403);
  }

  const pendingRequest = await prisma.passwordResetRequest.findFirst({
    where: {
      ownerId: owner.id,
      status: 'PENDING',
    },
  });

  if (pendingRequest) {
    throw new AppError('A password reset request is already pending admin review.', 400);
  }

  const request = await prisma.passwordResetRequest.create({
    data: {
      ownerId: owner.id,
      reason: data.reason || null,
    },
  });

  res.status(201).json({
    requestId: request.id,
    status: request.status,
    message: 'Password reset request submitted. An administrator will review it shortly.',
  });
}));

/**
 * POST /api/owner-auth/change-password
 * Change owner password
 */
router.post('/change-password', authenticateOwnerAccount, asyncHandler(async (req, res) => {
  const data = changePasswordSchema.parse(req.body);
  const ownerId = (req as any).ownerId;

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  });

  if (!owner) {
    throw new AppError('Owner not found', 404);
  }

  if (!owner.passwordHash) {
    throw new AppError('Password not set for this account', 400);
  }

  // Verify current password
  const validPassword = await bcrypt.compare(data.currentPassword, owner.passwordHash);

  if (!validPassword) {
    throw new AppError('Current password is incorrect', 401);
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(data.newPassword, 12);

  // Update password
  await prisma.owner.update({
    where: { id: ownerId },
    data: { passwordHash: newPasswordHash },
  });

  res.json({ message: 'Password updated successfully' });
}));

/**
 * PUT /api/owner-auth/profile
 * Update owner profile
 */
router.put('/profile', authenticateOwnerAccount, asyncHandler(async (req, res) => {
  const data = updateProfileSchema.parse(req.body);
  const ownerId = (req as any).ownerId;

  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
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
      throw new AppError('Email already in use', 400);
    }
  }

  // Update profile
  const updatedOwner = await prisma.owner.update({
    where: { id: ownerId },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      isActive: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ owner: updatedOwner });
}));

export default router;

