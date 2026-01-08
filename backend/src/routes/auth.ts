import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { loginSchema, registerAdminSchema } from '../utils/validation.js';

const router = Router();

/**
 * POST /api/auth/login
 * Admin login
 */
router.post('/login', asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  
  const admin = await prisma.admin.findUnique({
    where: { email: data.email },
  });

  if (!admin) {
    throw new AppError('Invalid email or password', 401);
  }

  const validPassword = await bcrypt.compare(data.password, admin.passwordHash);
  
  if (!validPassword) {
    throw new AppError('Invalid email or password', 401);
  }

  // Get JWT secret with validation
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new AppError('Server configuration error', 500);
  }

  const token = jwt.sign(
    { adminId: admin.id },
    jwtSecret || 'development-fallback-secret-change-in-production',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
  });
}));

/**
 * POST /api/auth/register
 * Register new admin (protected - only superadmin can create admins)
 */
router.post('/register', authenticateAdmin, asyncHandler(async (req, res) => {
  // Only superadmin can create new admins
  if (req.admin?.role !== 'superadmin') {
    throw new AppError('Only superadmins can create new admin accounts', 403);
  }

  const data = registerAdminSchema.parse(req.body);
  
  // Check if email already exists
  const existing = await prisma.admin.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    throw new AppError('Email already registered', 400);
  }

  const passwordHash = await bcrypt.hash(data.password, 12);

  const admin = await prisma.admin.create({
    data: {
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  res.status(201).json({ admin });
}));

/**
 * GET /api/auth/me
 * Get current admin profile
 */
router.get('/me', authenticateAdmin, asyncHandler(async (req, res) => {
  res.json({ admin: req.admin });
}));

/**
 * POST /api/auth/change-password
 * Change admin password
 */
router.post('/change-password', authenticateAdmin, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current password and new password are required', 400);
  }

  if (newPassword.length < 6) {
    throw new AppError('New password must be at least 6 characters', 400);
  }

  const admin = await prisma.admin.findUnique({
    where: { id: req.admin!.id },
  });

  if (!admin) {
    throw new AppError('Admin not found', 404);
  }

  const validPassword = await bcrypt.compare(currentPassword, admin.passwordHash);
  
  if (!validPassword) {
    throw new AppError('Current password is incorrect', 401);
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: newPasswordHash },
  });

  res.json({ message: 'Password updated successfully' });
}));

export default router;
