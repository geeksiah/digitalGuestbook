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
      coupleToken?: string;
    }
  }
}

// Admin Authentication (JWT)
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authentication token provided', 401);
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as { adminId: string };

    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!admin) {
      throw new AppError('Admin not found', 401);
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid authentication token', 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Authentication token expired', 401));
    }
    next(new AppError('Authentication failed', 401));
  }
};

// Couple Portal Authentication (Token-based)
export const authenticateCouple = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const coupleToken = req.headers['x-couple-token'] as string;
    
    if (!coupleToken) {
      throw new AppError('No access token provided', 401);
    }

    const event = await prisma.event.findUnique({
      where: { coupleAccessToken: coupleToken },
    });

    if (!event) {
      throw new AppError('Invalid access token', 401);
    }

    req.event = event;
    req.coupleToken = coupleToken;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
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
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'fallback-secret'
      ) as { adminId: string };

      const admin = await prisma.admin.findUnique({
        where: { id: decoded.adminId },
        select: { id: true, email: true, name: true, role: true },
      });

      if (admin) {
        req.admin = admin;
      }
    }
    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
};
