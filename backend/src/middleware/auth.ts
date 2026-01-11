import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { AppError } from './errorHandler.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: string;
        email: string;
        name: string;
        role: string;
      };
      event?: any;
      ownerToken?: string;
      ownerId?: string;
      owner?: {
        id: string;
        email: string;
        name: string;
        isActive: boolean;
      };
    }
  }
}

// Get JWT secret with validation
const getJwtSecret = (): string => {
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
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      throw new AppError('Invalid authentication token', 401);
    }

    let decoded: { adminId: string; iat: number; exp: number };
    
    try {
      decoded = jwt.verify(token, getJwtSecret()) as typeof decoded;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AppError('Session expired. Please sign in again.', 401);
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid authentication token', 401);
      }
      throw new AppError('Authentication failed', 401);
    }

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!admin) {
      throw new AppError('Account not found. Please sign in again.', 401);
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('[Auth] Authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

// Event Owner Portal Authentication (Token-based)
export const authenticateOwner = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ownerToken = req.headers['x-owner-token'] as string;
    
    if (!ownerToken || ownerToken === 'null' || ownerToken === 'undefined') {
      throw new AppError('Access token required', 401);
    }

    const event = await prisma.event.findUnique({
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
      throw new AppError('Invalid or expired access token', 401);
    }

    req.event = event;
    req.ownerToken = ownerToken;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('[Auth] Owner authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

// Alias for backward compatibility
export const authenticateCouple = authenticateOwner;

// Owner Account Authentication (JWT-based)
export const authenticateOwnerAccount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401);
    }

    const token = authHeader.split(' ')[1];
    
    if (!token || token === 'null' || token === 'undefined') {
      throw new AppError('Invalid authentication token', 401);
    }

    let decoded: { ownerId: string; iat: number; exp: number };
    
    try {
      decoded = jwt.verify(token, getJwtSecret()) as typeof decoded;
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        throw new AppError('Session expired. Please sign in again.', 401);
      }
      if (jwtError instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid authentication token', 401);
      }
      throw new AppError('Authentication failed', 401);
    }

    const owner = await prisma.owner.findUnique({
      where: { id: decoded.ownerId },
      select: { id: true, email: true, name: true, isActive: true },
    });

    if (!owner) {
      throw new AppError('Account not found. Please sign in again.', 401);
    }

    if (!owner.isActive) {
      throw new AppError('Account is inactive. Please contact support.', 403);
    }

    (req as any).ownerId = owner.id;
    (req as any).owner = owner;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    console.error('[Auth] Owner account authentication error:', error);
    next(new AppError('Authentication failed', 401));
  }
};

// Optional Admin Auth (for routes that work with or without auth)
export const optionalAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      if (token && token !== 'null' && token !== 'undefined') {
        try {
          const decoded = jwt.verify(token, getJwtSecret()) as { adminId: string };

          const admin = await prisma.admin.findUnique({
            where: { id: decoded.adminId },
            select: { id: true, email: true, name: true, role: true },
          });

          if (admin) {
            req.admin = admin;
          }
        } catch {
          // Token invalid but optional, continue without auth
        }
      }
    }
    next();
  } catch {
    // Silently continue without auth
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin) {
      return next(new AppError('Authentication required', 401));
    }
    
    if (!roles.includes(req.admin.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    
    next();
  };
};
