import { Request, Response, NextFunction } from 'express';

interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  ip?: string;
  userAgent?: string;
  error?: string;
}

const logEntry = (entry: LogEntry) => {
  const logLevel = entry.statusCode >= 500 ? 'ERROR' : entry.statusCode >= 400 ? 'WARN' : 'INFO';
  const prefix = `[${logLevel}] [${entry.timestamp}]`;
  const message = `${entry.method} ${entry.path} - ${entry.statusCode} (${entry.duration}ms)`;
  const details = entry.error ? ` | Error: ${entry.error}` : '';
  const metadata = entry.ip ? ` | IP: ${entry.ip}` : '';
  
  if (logLevel === 'ERROR') {
    console.error(`${prefix} ${message}${details}${metadata}`);
  } else if (logLevel === 'WARN') {
    console.warn(`${prefix} ${message}${details}${metadata}`);
  } else {
    console.log(`${prefix} ${message}${metadata}`);
  }
};

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const start = Date.now();
  
  // Log request start for long operations
  if (req.path.includes('/generate-reel') || req.path.includes('/upload')) {
    console.log(`[INFO] [${new Date().toISOString()}] ${req.method} ${req.path} - Started`);
  }
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logEntry({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    });
    
    // Log warnings for slow requests
    if (duration > 5000 && res.statusCode < 400) {
      console.warn(`[WARN] [${new Date().toISOString()}] Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  // Capture errors
  res.on('error', (error: Error) => {
    logEntry({
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode || 500,
      duration: Date.now() - start,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      error: error.message,
    });
  });
  
  next();
};
