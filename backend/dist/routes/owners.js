"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const zod_1 = require("zod");
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
exports.default = router;
//# sourceMappingURL=owners.js.map