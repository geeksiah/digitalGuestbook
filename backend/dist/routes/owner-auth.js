"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// Validation schemas
const registerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    email: zod_1.z.string().email('Valid email is required'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z.string().min(6, 'New password must be at least 6 characters'),
});
const setupPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Valid email is required'),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters'),
});
const updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    company: zod_1.z.string().optional(),
});
// Get JWT secret
const getJwtSecret = () => {
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
router.post('/register', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = registerSchema.parse(req.body);
    // Check if email already exists
    const existing = await prisma_js_1.default.owner.findUnique({
        where: { email: data.email },
    });
    if (existing) {
        throw new errorHandler_js_1.AppError('Email already registered', 400);
    }
    // Hash password
    const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
    // Create owner
    const owner = await prisma_js_1.default.owner.create({
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
    const token = jsonwebtoken_1.default.sign({ ownerId: owner.id }, jwtSecret, { expiresIn });
    // Update last login
    await prisma_js_1.default.owner.update({
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
router.post('/login', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = loginSchema.parse(req.body);
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { email: data.email },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Invalid email or password', 401);
    }
    // Check if owner has password set (admin-created owners might not have passwords)
    if (!owner.passwordHash) {
        throw new errorHandler_js_1.AppError('Account was created by admin. Please contact support to set up your password.', 401);
    }
    // Verify password
    const validPassword = await bcryptjs_1.default.compare(data.password, owner.passwordHash);
    if (!validPassword) {
        throw new errorHandler_js_1.AppError('Invalid email or password', 401);
    }
    // Check if account is active
    if (!owner.isActive) {
        throw new errorHandler_js_1.AppError('Account is inactive. Please contact support.', 403);
    }
    // Generate JWT token
    const jwtSecret = getJwtSecret();
    const expiresIn = 2592000; // 30 days
    const token = jsonwebtoken_1.default.sign({ ownerId: owner.id }, jwtSecret, { expiresIn });
    // Update last login
    await prisma_js_1.default.owner.update({
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
router.get('/me', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
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
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    res.json({ owner });
}));
/**
 * POST /api/owner-auth/setup-password
 * Set initial password for admin-created owner accounts
 */
router.post('/setup-password', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = setupPasswordSchema.parse(req.body);
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { email: data.email },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner account not found', 404);
    }
    // Check if password is already set
    if (owner.passwordHash) {
        throw new errorHandler_js_1.AppError('Password is already set. Use change-password endpoint instead.', 400);
    }
    // Check if account is active
    if (!owner.isActive) {
        throw new errorHandler_js_1.AppError('Account is inactive. Please contact support.', 403);
    }
    // Hash new password
    const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
    // Update password
    await prisma_js_1.default.owner.update({
        where: { id: owner.id },
        data: { passwordHash },
    });
    // Generate JWT token and return it (auto-login after setup)
    const jwtSecret = getJwtSecret();
    const expiresIn = 2592000; // 30 days
    const token = jsonwebtoken_1.default.sign({ ownerId: owner.id }, jwtSecret, { expiresIn });
    // Update last login
    await prisma_js_1.default.owner.update({
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
 * POST /api/owner-auth/change-password
 * Change owner password
 */
router.post('/change-password', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = changePasswordSchema.parse(req.body);
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    if (!owner.passwordHash) {
        throw new errorHandler_js_1.AppError('Password not set for this account', 400);
    }
    // Verify current password
    const validPassword = await bcryptjs_1.default.compare(data.currentPassword, owner.passwordHash);
    if (!validPassword) {
        throw new errorHandler_js_1.AppError('Current password is incorrect', 401);
    }
    // Hash new password
    const newPasswordHash = await bcryptjs_1.default.hash(data.newPassword, 12);
    // Update password
    await prisma_js_1.default.owner.update({
        where: { id: ownerId },
        data: { passwordHash: newPasswordHash },
    });
    res.json({ message: 'Password updated successfully' });
}));
/**
 * PUT /api/owner-auth/profile
 * Update owner profile
 */
router.put('/profile', auth_js_1.authenticateOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = updateProfileSchema.parse(req.body);
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
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
            throw new errorHandler_js_1.AppError('Email already in use', 400);
        }
    }
    // Update profile
    const updatedOwner = await prisma_js_1.default.owner.update({
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
exports.default = router;
//# sourceMappingURL=owner-auth.js.map