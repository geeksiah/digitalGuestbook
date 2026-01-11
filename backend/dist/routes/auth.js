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
const validation_js_1 = require("../utils/validation.js");
const router = (0, express_1.Router)();
/**
 * POST /api/auth/login
 * Admin login
 */
router.post('/login', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.loginSchema.parse(req.body);
    const admin = await prisma_js_1.default.admin.findUnique({
        where: { email: data.email },
    });
    if (!admin) {
        throw new errorHandler_js_1.AppError('Invalid email or password', 401);
    }
    const validPassword = await bcryptjs_1.default.compare(data.password, admin.passwordHash);
    if (!validPassword) {
        throw new errorHandler_js_1.AppError('Invalid email or password', 401);
    }
    // Get JWT secret with validation
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
        throw new errorHandler_js_1.AppError('Server configuration error', 500);
    }
    // Default to 30 days in seconds (2592000)
    const expiresIn = process.env.JWT_EXPIRES_IN
        ? parseInt(process.env.JWT_EXPIRES_IN, 10) || 2592000
        : 2592000;
    const token = jsonwebtoken_1.default.sign({ adminId: admin.id }, jwtSecret || 'development-fallback-secret-change-in-production', { expiresIn });
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
router.post('/register', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    // Only superadmin can create new admins
    if (req.admin?.role !== 'superadmin') {
        throw new errorHandler_js_1.AppError('Only superadmins can create new admin accounts', 403);
    }
    const data = validation_js_1.registerAdminSchema.parse(req.body);
    // Check if email already exists
    const existing = await prisma_js_1.default.admin.findUnique({
        where: { email: data.email },
    });
    if (existing) {
        throw new errorHandler_js_1.AppError('Email already registered', 400);
    }
    const passwordHash = await bcryptjs_1.default.hash(data.password, 12);
    const admin = await prisma_js_1.default.admin.create({
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
router.get('/me', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    res.json({ admin: req.admin });
}));
/**
 * POST /api/auth/change-password
 * Change admin password
 */
router.post('/change-password', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
        throw new errorHandler_js_1.AppError('Current password and new password are required', 400);
    }
    if (newPassword.length < 6) {
        throw new errorHandler_js_1.AppError('New password must be at least 6 characters', 400);
    }
    const admin = await prisma_js_1.default.admin.findUnique({
        where: { id: req.admin.id },
    });
    if (!admin) {
        throw new errorHandler_js_1.AppError('Admin not found', 404);
    }
    const validPassword = await bcryptjs_1.default.compare(currentPassword, admin.passwordHash);
    if (!validPassword) {
        throw new errorHandler_js_1.AppError('Current password is incorrect', 401);
    }
    const newPasswordHash = await bcryptjs_1.default.hash(newPassword, 12);
    await prisma_js_1.default.admin.update({
        where: { id: admin.id },
        data: { passwordHash: newPasswordHash },
    });
    res.json({ message: 'Password updated successfully' });
}));
exports.default = router;
//# sourceMappingURL=auth.js.map