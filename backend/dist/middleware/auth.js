"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.optionalAdminAuth = exports.authenticateAdminOrOwnerAccount = exports.authenticateOwnerAccount = exports.authenticateCouple = exports.authenticateOwner = exports.authenticateAdmin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("./errorHandler.js");
// Get JWT secret with validation
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'fallback-secret') {
        if (process.env.NODE_ENV === 'production') {
            console.error('[Auth] CRITICAL: JWT_SECRET not set in production!');
            throw new Error('JWT_SECRET must be set in production');
        }
        console.warn('[Auth] Warning: Using fallback JWT secret - set JWT_SECRET in production');
        return 'development-fallback-secret-change-in-production';
    }
    return secret;
};
// Admin Authentication (JWT)
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_js_1.AppError('Authentication required', 401);
        }
        const token = authHeader.split(' ')[1];
        if (!token || token === 'null' || token === 'undefined') {
            throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
        }
        catch (jwtError) {
            if (jwtError instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errorHandler_js_1.AppError('Session expired. Please sign in again.', 401);
            }
            if (jwtError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
            }
            throw new errorHandler_js_1.AppError('Authentication failed', 401);
        }
        const admin = await prisma_js_1.default.admin.findUnique({
            where: { id: decoded.adminId },
            select: { id: true, email: true, name: true, role: true },
        });
        if (!admin) {
            throw new errorHandler_js_1.AppError('Account not found. Please sign in again.', 401);
        }
        req.admin = admin;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_js_1.AppError) {
            return next(error);
        }
        console.error('[Auth] Authentication error:', error);
        next(new errorHandler_js_1.AppError('Authentication failed', 401));
    }
};
exports.authenticateAdmin = authenticateAdmin;
// Event Owner Portal Authentication (Token-based)
const authenticateOwner = async (req, res, next) => {
    try {
        const ownerToken = req.headers['x-owner-token'];
        if (!ownerToken || ownerToken === 'null' || ownerToken === 'undefined') {
            throw new errorHandler_js_1.AppError('Access token required', 401);
        }
        const event = await prisma_js_1.default.event.findUnique({
            where: { ownerAccessToken: ownerToken },
            select: {
                id: true,
                name: true,
                slug: true,
                date: true,
                venue: true,
                timezone: true,
                phase: true,
                invitationOnly: true,
                reelEnabled: true,
            },
        });
        if (!event) {
            throw new errorHandler_js_1.AppError('Invalid or expired access token', 401);
        }
        req.event = event;
        req.ownerToken = ownerToken;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_js_1.AppError) {
            return next(error);
        }
        console.error('[Auth] Owner authentication error:', error);
        next(new errorHandler_js_1.AppError('Authentication failed', 401));
    }
};
exports.authenticateOwner = authenticateOwner;
// Alias for backward compatibility
exports.authenticateCouple = exports.authenticateOwner;
// Owner Account Authentication (JWT-based)
const authenticateOwnerAccount = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_js_1.AppError('Authentication required', 401);
        }
        const token = authHeader.split(' ')[1];
        if (!token || token === 'null' || token === 'undefined') {
            throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
        }
        catch (jwtError) {
            if (jwtError instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errorHandler_js_1.AppError('Session expired. Please sign in again.', 401);
            }
            if (jwtError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
            }
            throw new errorHandler_js_1.AppError('Authentication failed', 401);
        }
        const owner = await prisma_js_1.default.owner.findUnique({
            where: { id: decoded.ownerId },
            select: { id: true, email: true, name: true, isActive: true },
        });
        if (!owner) {
            throw new errorHandler_js_1.AppError('Account not found. Please sign in again.', 401);
        }
        if (!owner.isActive) {
            throw new errorHandler_js_1.AppError('Account is inactive. Please contact support.', 403);
        }
        req.ownerId = owner.id;
        req.owner = owner;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_js_1.AppError) {
            return next(error);
        }
        console.error('[Auth] Owner account authentication error:', error);
        next(new errorHandler_js_1.AppError('Authentication failed', 401));
    }
};
exports.authenticateOwnerAccount = authenticateOwnerAccount;
// Admin OR Owner Account Authentication (JWT-based)
const authenticateAdminOrOwnerAccount = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new errorHandler_js_1.AppError('Authentication required', 401);
        }
        const token = authHeader.split(' ')[1];
        if (!token || token === 'null' || token === 'undefined') {
            throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
        }
        catch (jwtError) {
            if (jwtError instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errorHandler_js_1.AppError('Session expired. Please sign in again.', 401);
            }
            if (jwtError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
            }
            throw new errorHandler_js_1.AppError('Authentication failed', 401);
        }
        if (decoded?.adminId) {
            const admin = await prisma_js_1.default.admin.findUnique({
                where: { id: decoded.adminId },
                select: { id: true, email: true, name: true, role: true },
            });
            if (!admin)
                throw new errorHandler_js_1.AppError('Account not found. Please sign in again.', 401);
            req.admin = admin;
            return next();
        }
        if (decoded?.ownerId) {
            const owner = await prisma_js_1.default.owner.findUnique({
                where: { id: decoded.ownerId },
                select: { id: true, email: true, name: true, isActive: true },
            });
            if (!owner)
                throw new errorHandler_js_1.AppError('Account not found. Please sign in again.', 401);
            if (!owner.isActive)
                throw new errorHandler_js_1.AppError('Account is inactive. Please contact support.', 403);
            req.ownerId = owner.id;
            req.owner = owner;
            return next();
        }
        throw new errorHandler_js_1.AppError('Invalid authentication token', 401);
    }
    catch (error) {
        if (error instanceof errorHandler_js_1.AppError) {
            return next(error);
        }
        console.error('[Auth] Admin/Owner authentication error:', error);
        next(new errorHandler_js_1.AppError('Authentication failed', 401));
    }
};
exports.authenticateAdminOrOwnerAccount = authenticateAdminOrOwnerAccount;
// Optional Admin Auth (for routes that work with or without auth)
const optionalAdminAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token && token !== 'null' && token !== 'undefined') {
                try {
                    const decoded = jsonwebtoken_1.default.verify(token, getJwtSecret());
                    const admin = await prisma_js_1.default.admin.findUnique({
                        where: { id: decoded.adminId },
                        select: { id: true, email: true, name: true, role: true },
                    });
                    if (admin) {
                        req.admin = admin;
                    }
                }
                catch {
                    // Token invalid but optional, continue without auth
                }
            }
        }
        next();
    }
    catch {
        // Silently continue without auth
        next();
    }
};
exports.optionalAdminAuth = optionalAdminAuth;
// Role-based authorization middleware
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.admin) {
            return next(new errorHandler_js_1.AppError('Authentication required', 401));
        }
        if (!roles.includes(req.admin.role)) {
            return next(new errorHandler_js_1.AppError('Insufficient permissions', 403));
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map