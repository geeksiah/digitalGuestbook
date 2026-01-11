import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { z } from 'zod';

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

export default router;

