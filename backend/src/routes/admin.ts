import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/admin/dashboard
 * Get admin dashboard stats
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    totalEvents,
    activeEvents,
    totalRsvps,
    pendingRsvps,
    totalMedia,
  ] = await Promise.all([
    prisma.event.count({ where: { isArchived: false } }),
    prisma.event.count({ 
      where: { 
        isArchived: false,
        date: { lte: new Date() },
        OR: [
          { endDate: { gte: new Date() } },
          { endDate: null },
        ],
      } 
    }),
    prisma.rSVP.count(),
    prisma.rSVP.count({ where: { status: 'PENDING' } }),
    prisma.mediaAsset.count(),
  ]);

  res.json({
    stats: {
      totalEvents,
      activeEvents,
      totalRsvps,
      pendingRsvps,
      totalMedia,
    },
  });
}));

/**
 * GET /api/admin/audit-logs
 * Get audit logs with pagination
 */
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { page = '1', limit = '50', eventId, action } = req.query;
  
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = {};
  if (eventId) where.eventId = eventId;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        event: { select: { name: true, slug: true } },
        admin: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / take),
    },
  });
}));

/**
 * GET /api/admin/admins
 * List all admins (superadmin only)
 */
router.get('/admins', asyncHandler(async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    throw new AppError('Access denied', 403);
  }

  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ admins });
}));

export default router;
