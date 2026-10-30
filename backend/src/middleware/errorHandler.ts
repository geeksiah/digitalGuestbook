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

/** What guests see when something fails on our side. No internals. */
export const GENERIC_SERVER_ERROR = 'Something went wrong on our side. Please refresh the page and try again.';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));

/**
 * A small self-contained page for browsers that land on the API host directly,
 * so they never see raw JSON or a stack trace.
 */
export const renderFriendlyPage = ({ title, message }: { title: string; message: string }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f5f6f7;color:#1a1a2e;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  .card{width:100%;max-width:420px;background:#fff;border:1px solid #e8eaec;border-radius:12px;padding:24px;text-align:center}
  h1{margin:0;font-size:20px;color:#063932}
  p{margin:8px 0 0;font-size:14px;line-height:1.5;color:#5b6469}
  button{margin-top:20px;min-height:40px;padding:0 16px;border:0;border-radius:8px;background:#063932;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
</style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <button type="button" onclick="location.reload()">Refresh page</button>
  </div>
</body>
</html>`;

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Response already streaming: let Express close the connection.
  if (res.headersSent) return next(err);

  let statusCode = 500;
  let errorMessage = GENERIC_SERVER_ERROR;
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
  // Malformed or oversized request bodies (express.json / urlencoded)
  else if ((err as any).type === 'entity.parse.failed') {
    statusCode = 400;
    errorMessage = 'The request could not be read. Please try again.';
  }
  else if ((err as any).type === 'entity.too.large') {
    statusCode = 413;
    errorMessage = 'That upload is too large.';
  }
  // Database unreachable (common right after a cold start)
  else if (
    err.name === 'PrismaClientInitializationError'
    || err.name === 'PrismaClientRustPanicError'
    || (err as any).code === 'P1001'
    || (err as any).code === 'P1017'
  ) {
    statusCode = 503;
    errorMessage = 'We are getting things ready. Please refresh the page in a moment.';
    res.set('Retry-After', '10');
  }

  // Server-side failures can carry internal text (storage, SMTP, SQL...), e.g.
  // "Failed to upload file: <provider error>". Outside development keep only
  // our own wording before the first colon.
  if (statusCode >= 500 && statusCode !== 503 && process.env.NODE_ENV !== 'development') {
    const ownWording = err instanceof AppError ? errorMessage.split(':')[0].trim() : '';
    errorMessage = ownWording && ownWording.length < 120
      ? `${ownWording.replace(/[.!]+$/, '')}. Please try again.`
      : GENERIC_SERVER_ERROR;
  }

  // Log the error
  logError(err, req, statusCode);

  // A browser navigating straight to the API gets a page, not JSON.
  const wantsHtml = req.method === 'GET'
    && !req.path.startsWith('/api/')
    && req.accepts(['html', 'json']) === 'html';
  if (wantsHtml) {
    res.status(statusCode).type('html').send(renderFriendlyPage({
      title: statusCode >= 500 ? 'This page did not load' : 'Something is not right',
      message: errorMessage,
    }));
    return;
  }

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
