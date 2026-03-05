import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import prisma from './utils/prisma.js';
import { DEFAULT_VOTING_TEMPLATE } from './utils/defaultVotingTemplate.js';
import {
  DEFAULT_VOTING_LEADERBOARD_TEMPLATE,
  DEFAULT_VOTING_NOMINATION_TEMPLATE,
  DEFAULT_VOTING_NOMINEES_TEMPLATE,
} from './utils/defaultVotingSplitTemplates.js';

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

  // Prisma schema expects DIRECT_URL for migration/schema operations.
  // Keep deploys resilient by falling back to DATABASE_URL when DIRECT_URL is not explicitly set.
  if (!process.env.DIRECT_URL || process.env.DIRECT_URL === '') {
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    if (process.env.NODE_ENV === 'production') {
      console.warn('DIRECT_URL is not set. Falling back to DATABASE_URL for Prisma schema operations.');
    }
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
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Try to check if admin table exists by attempting a count
    let adminCount = 0;
    try {
      adminCount = await prisma.admin.count();
    } catch (error: any) {
      if (error.code === 'P2021') {
        console.warn('[Database] Admin table does not exist yet. Schema may still be syncing.');
        console.warn('[Database] Skipping seed data initialization for now.');
        return;
      }
      throw error;
    }

    if (adminCount === 0) {
      console.log('🌱 No admin found, creating default admin...');
      
      if (process.env.NODE_ENV === 'production') {
        if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123') {
          throw new Error('ADMIN_PASSWORD must be set in production environment. Please set a secure password.');
        }
        if (!process.env.ADMIN_EMAIL || process.env.ADMIN_EMAIL === 'admin@example.com') {
          throw new Error('ADMIN_EMAIL must be set in production environment. Please set a valid email address.');
        }
      }
      
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
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
          { id: 'default-rsvp', name: 'Ticket Checkout Flow', type: 'RSVP', isDefault: true, htmlContent: '<div>RSVP / Ticket Page</div>', cssContent: '' },
          { id: 'default-guestbook', name: 'Modern Guestbook', type: 'GUESTBOOK', isDefault: true, htmlContent: '<div>Guestbook</div>', cssContent: '' },
          { id: 'default-thankyou', name: 'Thank You', type: 'THANK_YOU', isDefault: true, htmlContent: '<div>Thank You</div>', cssContent: '' },
          { id: 'default-gifting', name: 'Modern Gifting Catalog', type: 'GIFTING', isDefault: true, htmlContent: '<div>Gifting Catalog</div>', cssContent: '' },
        ],
      });
      console.log('✅ Default templates created');
    }
    // Ensure core defaults exist on already-populated databases too.
    const requiredDefaults = [
      { id: 'default-rsvp', name: 'Ticket Checkout Flow', type: 'RSVP', htmlContent: '<div>RSVP / Ticket Page</div>' },
      { id: 'default-gifting', name: 'Modern Gifting Catalog', type: 'GIFTING', htmlContent: '<div>Gifting Catalog</div>' },
    ] as const;

    for (const template of requiredDefaults) {
      await prisma.template.upsert({
        where: { id: template.id },
        update: {},
        create: {
          id: template.id,
          name: template.name,
          type: template.type,
          isDefault: true,
          htmlContent: template.htmlContent,
          cssContent: '',
        },
      });
    }

    await prisma.template.upsert({
      where: { id: DEFAULT_VOTING_TEMPLATE.id },
      update: {},
      create: {
        id: DEFAULT_VOTING_TEMPLATE.id,
        name: DEFAULT_VOTING_TEMPLATE.name,
        description: DEFAULT_VOTING_TEMPLATE.description,
        type: DEFAULT_VOTING_TEMPLATE.type,
        isDefault: DEFAULT_VOTING_TEMPLATE.isDefault,
        htmlContent: DEFAULT_VOTING_TEMPLATE.htmlContent,
        cssContent: DEFAULT_VOTING_TEMPLATE.cssContent,
        jsContent: DEFAULT_VOTING_TEMPLATE.jsContent,
      },
    });

    for (const template of [
      DEFAULT_VOTING_NOMINATION_TEMPLATE,
      DEFAULT_VOTING_NOMINEES_TEMPLATE,
      DEFAULT_VOTING_LEADERBOARD_TEMPLATE,
    ]) {
      await prisma.template.upsert({
        where: { id: template.id },
        update: {},
        create: {
          id: template.id,
          name: template.name,
          description: template.description,
          type: template.type,
          isDefault: template.isDefault,
          htmlContent: template.htmlContent,
          cssContent: template.cssContent,
          jsContent: template.jsContent,
        },
      });
    }

    // Create system settings if not exists
    const settings = await prisma.systemSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      await prisma.systemSettings.create({
        data: { id: 'default', siteName: 'EventPeepo' },
      });
      console.log('✅ System settings initialized');
    }

    // Create default email provider from environment variables if none exists
    const emailProviderCount = await prisma.emailProvider.count();
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
          smtpPort: Number.parseInt(smtpPort, 10),
          smtpSecure: process.env.DEFAULT_EMAIL_SECURE === 'true' || process.env.SMTP_SECURE === 'true',
          smtpUser: smtpUser,
          smtpPass: smtpPass || '',
          fromEmail: fromEmail || smtpUser || '',
          fromName: process.env.DEFAULT_EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'EventPeepo',
          isDefault: true,
          isActive: true,
        },
      });
      console.log('✅ Default email provider created from environment variables');
      
      await prisma.systemSettings.update({
        where: { id: 'default' },
        data: { emailEnabled: true },
      });
      console.log('✅ Email service enabled in system settings');
    } else if (emailProviderCount === 0) {
      console.log('ℹ️  No email provider configured. Set SMTP_HOST and SMTP_USER (or DEFAULT_EMAIL_*) to enable email notifications.');
    } else {
      const hasActiveProvider = await prisma.emailProvider.findFirst({
        where: { isActive: true, isDefault: true },
      });
      if (hasActiveProvider && settings && !settings.emailEnabled) {
        console.log('🌱 Enabling email service (provider exists but was disabled)...');
        await prisma.systemSettings.update({
          where: { id: 'default' },
          data: { emailEnabled: true },
        });
        console.log('✅ Email service enabled');
      } else if (hasActiveProvider && settings?.emailEnabled) {
        console.log('✅ Email service is enabled and provider is configured');
      }
    }

    // Create sample event if none exist
    const eventCount = await prisma.event.count();
    if (eventCount === 0) {
      console.log('🌱 Creating sample event...');
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
import itineraryRoutes from './routes/itinerary.js';
import giftingRoutes from './routes/gifting.js';
import whatsappWebhookRoutes from './routes/whatsapp-webhooks.js';
import paystackWebhookRoutes from './routes/paystack-webhooks.js';
import webhooksRoutes from './routes/webhooks.js';
import votingRoutes from './routes/voting.js';
import votingOwnerRoutes from './routes/voting-owner.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { authenticateAdmin } from './middleware/auth.js';

const app = express();
const port = Number(process.env.PORT) || 10000;

// Trust proxy (required for rate limiting behind reverse proxy like Render)
app.set('trust proxy', 1);

// Request Compression (gzip)
app.use(compression());

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ═══════════════════════════════════════════════════════════════════════════════
// CORS Configuration — FIXED: single unified allowedOrigins, no duplicate
// ═══════════════════════════════════════════════════════════════════════════════
import { getSiteUrl } from './utils/siteUrl.js';

const allowedOrigins: string[] = [
  getSiteUrl(),
  'https://digiguestbook.netlify.app',
  'https://app.eventpeepo.com',
  // Include any comma-separated values from CORS_ORIGIN
  ...(process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean),
  process.env.FRONTEND_URL,
  process.env.SITE_URL,
  process.env.APP_URL,
].filter(Boolean) as string[];

// Add local app origins outside production (web + emulator + Capacitor app shell).
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push(
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://10.0.2.2:5174',
    'capacitor://localhost'
  );
}

// Deduplicate
const uniqueOrigins = [...new Set(allowedOrigins)];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    if (process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(origin);
        const localHosts = new Set(['localhost', '127.0.0.1', '10.0.2.2']);
        if (localHosts.has(parsed.hostname)) {
          return callback(null, true);
        }
      } catch {
        // Invalid URL -> fall through to standard checks.
      }
    }

    if (uniqueOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow any *.eventpeepo.com subdomain
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.eventpeepo.com')) {
        return callback(null, true);
      }
    } catch {
      // Invalid URL — fall through to deny
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Couple-Token', 'X-Owner-Token', 'X-Invite-Token'],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  validate: {
    trustProxy: false,
  },
});
app.use('/api/', limiter);

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  keyGenerator: (req) => {
    return req.ip || req.socket.remoteAddress || 'unknown';
  },
  validate: {
    trustProxy: false,
  },
});
app.use('/api/auth/', authLimiter);

// Body Parsing
app.use('/api/paystack/webhooks', express.raw({ type: 'application/json', limit: '2mb' }), paystackWebhookRoutes);
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '2mb' }), webhooksRoutes);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logging
app.use(requestLogger);

// Simple root endpoint for Render.com port detection
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'EventPeepo API',
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
    const { checkDatabaseHealth } = await import('./utils/prisma.js');
    const startDbCheck = Date.now();
    const dbHealthy = await checkDatabaseHealth();
    const dbCheckTime = Date.now() - startDbCheck;
    
    healthStatus.services.database = dbHealthy ? 'connected' : 'disconnected';
    healthStatus.checks.database = {
      status: dbHealthy ? 'pass' : 'fail',
      responseTime: `${dbCheckTime}ms`,
    };

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

    try {
      const { spawn } = await import('node:child_process');
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

    const memUsage = process.memoryUsage();
    healthStatus.resources = {
      memory: {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime())}s`,
    };

    const allChecks = Object.values(healthStatus.checks).flat();
    const hasFailures = allChecks.some((check: any) => check.status === 'fail');
    if (!hasFailures) {
      healthStatus.status = 'healthy';
    } else if (dbHealthy) {
      healthStatus.status = 'degraded';
    } else {
      healthStatus.status = 'unhealthy';
    }

    const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;
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
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/rsvp', rsvpRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/checkin', checkInRoutes);
app.use('/api/guestbook', guestbookRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/event-owner', eventOwnerRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ticketing', ticketingRoutes);
app.use('/api/payment-gateways', paymentGatewayRoutes);
app.use('/api/promo-codes', promoCodeRoutes);
app.use('/api/owners', ownerRoutes);
app.use('/api/owner-auth', ownerAuthRoutes);
app.use('/api/admin-voting', votingOwnerRoutes);
app.use('/api/owner-dashboard', votingOwnerRoutes);
app.use('/api/owner-dashboard', ownerDashboardRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/gifting', giftingRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/whatsapp', whatsappWebhookRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
try {
  validateEnvironmentVariables();
  
  console.log(`[Server] Starting server...`);
  console.log(`[Server] PORT environment variable: ${process.env.PORT || 'not set (using default 10000)'}`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`[Server] Attempting to bind to 0.0.0.0:${port}`);

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server listening on port ${port}`);
    console.log(`✅ Server bound to 0.0.0.0:${port}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Allowed CORS origins: ${uniqueOrigins.join(', ')}`);
    console.log(`✅ Ready to accept connections`);
    
    setTimeout(() => {
      initializeDatabase().catch((error) => {
        console.error('[Database] Initialization failed (non-fatal):', error);
      });
    }, 1000);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    console.error(`[Server] ❌ Error starting server:`, error);
    if (error.code === 'EADDRINUSE') {
      console.error(`[Server] ❌ Port ${port} is already in use`);
    }
    process.exit(1);
  });

  server.on('listening', () => {
    const address = server.address();
    console.log(`[Server] ✅ Server is listening on:`, address);
  });

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
