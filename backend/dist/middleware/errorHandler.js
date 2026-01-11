"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = exports.errorHandler = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const logError = (err, req, statusCode) => {
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
    }
    else {
        console.warn('[WARN]', JSON.stringify(errorDetails, null, 2));
    }
    // In production, consider logging to external service (Sentry, LogRocket, etc.)
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
        // TODO: Integrate with external logging service
    }
};
const errorHandler = (err, req, res, _next) => {
    let statusCode = 500;
    let errorMessage = 'Internal server error';
    let errorDetails = undefined;
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        errorMessage = err.message;
    }
    // Prisma Errors
    else if (err.name === 'PrismaClientKnownRequestError') {
        statusCode = 400;
        errorMessage = 'Database operation failed';
        errorDetails = process.env.NODE_ENV === 'development' ? err.meta : undefined;
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
            errorDetails = err.issues || JSON.parse(err.message);
        }
        catch {
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
    else if (err.code === 'LIMIT_FILE_SIZE') {
        statusCode = 400;
        errorMessage = 'File size too large';
    }
    else if (err.code === 'LIMIT_FILE_COUNT') {
        statusCode = 400;
        errorMessage = 'Too many files uploaded';
    }
    // ENOENT Errors (File not found)
    else if (err.code === 'ENOENT') {
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
exports.errorHandler = errorHandler;
// Async handler wrapper to catch errors
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
exports.asyncHandler = asyncHandler;
//# sourceMappingURL=errorHandler.js.map