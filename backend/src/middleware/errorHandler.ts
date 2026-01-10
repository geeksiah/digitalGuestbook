import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const logError = (err: Error | AppError, req: Request, statusCode: number) => {
  const timestamp = new Date().toISOString();
  const errorDetails = {
    timestamp,
    level: statusCode >= 500 ? 'ERROR' : 'WARN',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    statusCode,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
    body: req.method !== 'GET' ? JSON.stringify(req.body).substring(0, 500) : undefined,
    query: Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : undefined,
  };

  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(errorDetails, null, 2));
  } else {
    console.warn('[WARN]', JSON.stringify(errorDetails, null, 2));
  }

  // In production, consider logging to external service (Sentry, LogRocket, etc.)
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    // TODO: Integrate with external logging service
  }
};

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let errorMessage = 'Internal server error';
  let errorDetails: any = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorMessage = err.message;
  }
  // Prisma Errors
  else if (err.name === 'PrismaClientKnownRequestError') {
    statusCode = 400;
    errorMessage = 'Database operation failed';
    errorDetails = process.env.NODE_ENV === 'development' ? (err as any).meta : undefined;
  }
  // Prisma Validation Errors
  else if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    errorMessage = 'Invalid data provided';
    errorDetails = process.env.NODE_ENV === 'development' ? err.message : undefined;
  }
  // Validation Errors (Zod)
  else if (err.name === 'ZodError') {
    statusCode = 400;
    errorMessage = 'Validation failed';
    try {
      errorDetails = (err as any).issues || JSON.parse(err.message);
    } catch {
      errorDetails = err.message;
    }
  }
  // JWT Errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorMessage = 'Invalid authentication token';
  }
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorMessage = 'Authentication token expired';
  }
  // Multer Errors (File Upload)
  else if ((err as any).code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    errorMessage = 'File size too large';
  }
  else if ((err as any).code === 'LIMIT_FILE_COUNT') {
    statusCode = 400;
    errorMessage = 'Too many files uploaded';
  }
  // ENOENT Errors (File not found)
  else if ((err as any).code === 'ENOENT') {
    statusCode = 404;
    errorMessage = 'Resource not found';
  }

  // Log the error
  logError(err, req, statusCode);

  // Send error response
  res.status(statusCode).json({
    error: errorMessage,
    ...(errorDetails && { details: errorDetails }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      name: err.name,
    }),
  });
};

// Async handler wrapper to catch errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
