import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import prisma from './utils/prisma.js';

// Load environment variables
dotenv.config();

// Validate required environment variables
function validateEnvironmentVariables() {
  const required = ['DATABASE_URL', 'JWT_SECRET'];
  const missing: string[] = [];
  
  required.forEach((key) => {
    if (!process.env[key] || process.env[key] === '') {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Additional production checks
  if (process.env.NODE_ENV === 'production') {
    const productionWarnings: string[] = [];
    
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
      productionWarnings.push('ADMIN_PASSWORD should be set to a secure value');
    }
    if (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL === 'admin@example.com') {
      productionWarnings.push('ADMIN_EMAIL should be set to a valid email');
    }
    
    if (productionWarnings.length > 0) {
      console.warn('⚠️  Production environment warnings:');
      productionWarnings.forEach(warning => console.warn(`   - ${warning}`));
    }
  }
}

// Auto-seed database on startup (creates admin if not exists)
async function initializeDatabase() {
  try {
    // Check if database is accessible and tables exist
    // Use unsafe query to avoid prepared statement issues with pooler
    try {
      await prisma.$queryRawUnsafe('SELECT 1 as health');
    } catch (dbError: any) {
      if (dbError.code === '42P05' || dbError.message?.includes('prepared statement')) {
        console.warn('[Database] Prepared statement issue detected (pooler limitation)');
      }
      console.warn('[Database] Connection test failed, tables may not exist yet:', dbError.message);
      console.warn('[Database] Waiting for schema sync...');
      // Wait a bit for prisma db push to complete if it's still running
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try to check if admin table exists by attempting a count
    let adminCount = 0;
    try {
      adminCount = await prisma.admin.count();
    } catch (error: any) {
      if (error.code === 'P2021') {
        // Table doesn't exist yet - schema sync is likely still running
        console.warn('[Database] Admin table does not exist yet. Schema may still be syncing.');
        console.warn('[Database] Skipping seed data initialization for now.');
        return;
      }
      throw error;
    }

    if (adminCount === 0) {
      console.log('🌱 No admin found, creating default admin...');
      
      // Validate required environment variables in production
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
          throw new Error('ADMIN_PASSWORD must be set in production environment. Please set a secure password.');
        }
        if (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL === 'admin@example.com') {
          throw new Error('ADMIN_EMAIL must be set in production environment. Please set a valid email address.');
        }
      }
      
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'; // Only for development
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com'; // Only for development
      const adminName = process.env.ADMIN_NAME || 'Platform Admin';
      
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.admin.create({
        data: {
          email: adminEmail,
          passwordHash,
          name: adminName,
          role: 'superadmin',
        },
      });
      console.log('✅ Default admin created: ' + adminEmail);
      if (process.env.NODE_ENV !== 'production') {
        console.warn('⚠️  Using default admin credentials. Set ADMIN_PASSWORD and ADMIN_EMAIL in production!');
      }
    }

    // Create default templates if none exist
    const templateCount = await prisma.template.count();
    if (templateCount === 0) {
      console.log('🌱 Creating default templates...');
      await prisma.template.createMany({
        data: [
          { id: 'default-invitation', name: 'Elegant Invitation', type: 'INVITATION', isDefault: true, htmlContent: '<div>{{event.name}}</div>', cssContent: '' },
          { id: 'default-rsvp', name: 'Classic RSVP', type: 'RSVP', isDefault: true, htmlContent: '<div>RSVP Form</div>', cssContent: '' },
          { id: 'default-guestbook', name: 'Modern Guestbook', type: 'GUESTBOOK', isDefault: true, htmlContent: '<div>Guestbook</div>', cssContent: '' },
          { id: 'default-thankyou', name: 'Thank You', type: 'THANK_YOU', isDefault: true, htmlContent: '<div>Thank You</div>', cssContent: '' },
        ],
      });
      console.log('✅ Default templates created');
    }

    // Create system settings if not exists
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      await prisma.systemSettings.create({
        data: { id: 'default', siteName: 'Digital Event Platform' },
      });
      console.log('✅ System settings initialized');
    }

    // Create default email provider from environment variables if none exists
    const emailProviderCount = await prisma.emailProvider.count();
    // Check for both DEFAULT_EMAIL_* and legacy SMTP_* variables
    const smtpHost = process.env.DEFAULT_EMAIL_HOST || process.env.SMTP_HOST;
    const smtpPort = process.env.DEFAULT_EMAIL_PORT || process.env.SMTP_PORT || '587';
    const smtpUser = process.env.DEFAULT_EMAIL_USER || process.env.SMTP_USER;
    const smtpPass = process.env.DEFAULT_EMAIL_PASS || process.env.SMTP_PASS;
    const fromEmail = process.env.DEFAULT_EMAIL_FROM || process.env.SMTP_FROM || smtpUser;
    
    if (emailProviderCount === 0 && smtpHost && smtpUser) {
      console.log('🌱 Creating default email provider from environment variables...');
      await prisma.emailProvider.create({
        data: {
          name: 'Default SMTP',
          provider: 'smtp',
          smtpHost: smtpHost,
          smtpPort: parseInt(smtpPort),
          smtpSecure: process.env.DEFAULT_EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
          smtpUser: smtpUser,
          smtpPass: smtpPass || '',
          fromEmail: fromEmail || smtpUser || '',
          fromName: process.env.DEFAULT_EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Digital Event Platform',
          isDefault: true,
          isActive: true,
        },
      });
      console.log('✅ Default email provider created from environment variables');
      
      // Enable email in system settings
      await prisma.systemSettings.update({
        where: { id: 'default' },
        data: { emailEnabled: true },
      });
    } else if (emailProviderCount === 0) {
      console.log('ℹ️  No email provider configured. Set SMTP_HOST and SMTP_USER (or DEFAULT_EMAIL_*) to enable email notifications.');
    }

    // Create sample event if none exist
    const eventCount = await prisma.event.count();
    if (eventCount === 0) {
      console.log('🌱 Creating sample event...');
      // Using type assertion for ownerName/ownerAccessToken - Prisma client types may be stale
      // These fields exist in schema and will be available at runtime
      const event = await prisma.event.create({
        data: {
          slug: 'sample-wedding',
          name: "Sarah & Michael's Wedding",
          description: 'Join us as we celebrate our love.',
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          timezone: 'America/New_York',
          venue: 'The Grand Ballroom',
          ownerName: 'Sarah & Michael',
          ownerEmail: 'events@example.com',
          invitationOnly: true,
          invitationEnabled: true,
          rsvpEnabled: true,
          guestbookEnabled: true,
          checkInEnabled: true,
        } as any,
      }) as any;
      console.log('✅ Sample event created: ' + event.slug);
      if (event.ownerAccessToken) {
        console.log('   Event Owner Portal: /event-owner/' + event.ownerAccessToken);
      }
    }
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Routes
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import eventRoutes from './routes/events.js';
import templateRoutes from './routes/templates.js';
import rsvpRoutes from './routes/rsvp.js';
import invitationRoutes from './routes/invitations.js';
import checkInRoutes from './routes/checkin.js';
import guestbookRoutes from './routes/guestbook.js';
import mediaRoutes from './routes/media.js';
import eventOwnerRoutes from './routes/event-owner.js';
import publicRoutes from './routes/public.js';
import settingsRoutes from './routes/settings.js';
import ticketingRoutes from './routes/ticketing.js';
import paymentGatewayRoutes from './routes/payment-gateways.js';
import promoCodeRoutes from './routes/promo-codes.js';
import ownerRoutes from './routes/owners.js';
import ownerAuthRoutes from './routes/owner-auth.js';
import ownerDashboardRoutes from './routes/owner-dashboard.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticateAdmin } from './middleware/auth.js';

const app = express();
// Render.com sets PORT=10000 by default for web services
// Follow Render.com recommendation: use process.env.PORT with fallback
const port = Number(process.env.PORT) || 10000;

// Trust proxy (required for rate limiting behind reverse proxy like Render)
app.set('trust proxy', true);

// Request Compression (gzip)
app.use(compression());

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Allow templates to load resources
}));

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://digiguestbook.netlify.app',
  process.env.CORS_ORIGIN,
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed origins or patterns
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.includes('*')) {
        const pattern = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
        return pattern.test(origin);
      }
      return origin === allowed || origin.startsWith(allowed);
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway in production for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Owner-Token'],
}));

// Rate Limiting (Non-Functional: Stable during high usage)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
});
app.use('/api/auth/', authLimiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use(requestLogger);

// Simple root endpoint for Render.com port detection
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'Digital Event Platform API',
    timestamp: new Date().toISOString()
  });
});

// Static Files (uploads, generated PDFs, templates)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/generated', express.static(path.join(process.cwd(), 'generated')));
app.use('/templates', express.static(path.join(process.cwd(), 'templates')));

// Enhanced Health Check with comprehensive status
app.get('/health', async (req, res) => {
  const healthStatus: any = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {},
    checks: {},
  };

  try {
    // Database Health Check
    const { checkDatabaseHealth } = await import('./utils/prisma.js');
    const startDbCheck = Date.now();
    const dbHealthy = await checkDatabaseHealth();
    const dbCheckTime = Date.now() - startDbCheck;
    
    healthStatus.services.database = dbHealthy ? 'connected' : 'disconnected';
    healthStatus.checks.database = {
      status: dbHealthy ? 'pass' : 'fail',
      responseTime: `${dbCheckTime}ms`,
    };

    // File System Health Check
    const fsChecks: any = {};
    const requiredDirs = ['uploads/media', 'generated/reels', 'templates/archives', 'data'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      try {
        fs.accessSync(dirPath, fs.constants.F_OK | fs.constants.W_OK);
        fsChecks[dir] = { status: 'pass', writable: true };
      } catch {
        try {
          fs.mkdirSync(dirPath, { recursive: true });
          fsChecks[dir] = { status: 'pass', writable: true, created: true };
        } catch {
          fsChecks[dir] = { status: 'fail', writable: false };
        }
      }
    }
    healthStatus.checks.filesystem = fsChecks;

    // FFmpeg Check (for reel generation)
    try {
      const { spawn } = await import('child_process');
      const ffmpegCheck = spawn('ffmpeg', ['-version']);
      await new Promise<void>((resolve, reject) => {
        ffmpegCheck.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error('FFmpeg not available'));
        });
        ffmpegCheck.on('error', reject);
        setTimeout(() => reject(new Error('FFmpeg check timeout')), 2000);
      });
      healthStatus.services.ffmpeg = 'available';
      healthStatus.checks.ffmpeg = { status: 'pass' };
    } catch {
      healthStatus.services.ffmpeg = 'unavailable';
      healthStatus.checks.ffmpeg = { status: 'fail', message: 'FFmpeg not installed' };
    }

    // Memory Usage
    const memUsage = process.memoryUsage();
    healthStatus.resources = {
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime())}s`,
    };

    // Determine overall status
    const allChecks = Object.values(healthStatus.checks).flat();
    const hasFailures = allChecks.some((check: any) => check.status === 'fail');
    healthStatus.status = hasFailures ? (dbHealthy ? 'degraded' : 'unhealthy') : 'healthy';

    const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(healthStatus);
  } catch (error: any) {
    healthStatus.status = 'unhealthy';
    healthStatus.error = error.message;
    res.status(503).json(healthStatus);
  }
});

// Detailed Health Check (for internal monitoring)
app.get('/health/detailed', authenticateAdmin, async (req, res) => {
  try {
    const { checkDatabaseHealth } = await import('./utils/prisma.js');
    const dbHealthy = await checkDatabaseHealth();

    // Database stats
    const [eventCount, rsvpCount, mediaCount, templateCount] = await Promise.all([
      prisma.event.count(),
      prisma.rSVP.count(),
      prisma.mediaAsset.count(),
      prisma.template.count(),
    ]).catch(() => [0, 0, 0, 0]);

    res.json({
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
        stats: {
          events: eventCount,
          rsvps: rsvpCount,
          media: mediaCount,
          templates: templateCount,
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        port: port,
      },
      resources: process.memoryUsage(),
      uptime: process.uptime(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// API Routes
// Authentication
app.use('/api/auth', authRoutes);

// Admin Routes (protected)
app.use('/api/admin', adminRoutes);

// Event Management (protected)
app.use('/api/events', eventRoutes);

// Template Management (protected)
app.use('/api/templates', templateRoutes);

// RSVP System
app.use('/api/rsvp', rsvpRoutes);

// Invitation Pass
app.use('/api/invitations', invitationRoutes);

// Check-In System
app.use('/api/checkin', checkInRoutes);

// Guestbook
app.use('/api/guestbook', guestbookRoutes);

// Media Management
app.use('/api/media', mediaRoutes);

// Event Owner Portal
app.use('/api/event-owner', eventOwnerRoutes);

// Public Event Pages
app.use('/api/public', publicRoutes);

// System Settings (admin only)
app.use('/api/settings', settingsRoutes);

// Ticketing & Custom Fields
app.use('/api/ticketing', ticketingRoutes);
app.use('/api/payment-gateways', paymentGatewayRoutes);
app.use('/api/promo-codes', promoCodeRoutes);

// Owner Management (protected)
app.use('/api/owners', ownerRoutes);

// Owner Authentication (public routes)
app.use('/api/owner-auth', ownerAuthRoutes);

// Owner Dashboard (protected)
app.use('/api/owner-dashboard', ownerDashboardRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
// Render.com requires binding to 0.0.0.0 explicitly for Docker services
try {
  // Validate environment variables before starting
  validateEnvironmentVariables();
  
  console.log(`[Server] Starting server...`);
  console.log(`[Server] PORT environment variable: ${process.env.PORT || 'not set (using default 10000)'}`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[Server] Attempting to bind to 0.0.0.0:${port}`);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`✅ Server bound to 0.0.0.0:${port}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Ready to accept connections`);
    
    // Initialize database after server starts (non-blocking)
    setTimeout(() => {
      initializeDatabase().catch((error) => {
        console.error('[Database] Initialization failed (non-fatal):', error);
        // Don't crash the server if initialization fails
      });
    }, 1000); // Wait 1 second before initializing DB
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`[Server] ❌ Error starting server:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[Server] ❌ Port ${port} is already in use`);
    }
    process.exit(1);
  });

  // Handle server listening state
  server.on('listening', () => {
    const address = server.address();
    console.log(`[Server] ✅ Server is listening on:`, address);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Server] SIGTERM received, shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('[Server] SIGINT received, shutting down gracefully...');
    server.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });

} catch (error: any) {
  console.error('[Server] ❌ Fatal error during server startup:', error);
  console.error('[Server] ❌ Stack trace:', error.stack);
  process.exit(1);
}

export default app;
