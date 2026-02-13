"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_js_1 = __importDefault(require("./utils/prisma.js"));
// Load environment variables
dotenv_1.default.config();
// Validate required environment variables
function validateEnvironmentVariables() {
    const required = ['DATABASE_URL', 'JWT_SECRET'];
    const missing = [];
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
        const productionWarnings = [];
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
            await prisma_js_1.default.$queryRawUnsafe('SELECT 1 as health');
        }
        catch (dbError) {
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
            adminCount = await prisma_js_1.default.admin.count();
        }
        catch (error) {
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
            const passwordHash = await bcryptjs_1.default.hash(adminPassword, 12);
            await prisma_js_1.default.admin.create({
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
        const templateCount = await prisma_js_1.default.template.count();
        if (templateCount === 0) {
            console.log('🌱 Creating default templates...');
            await prisma_js_1.default.template.createMany({
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
        const settings = await prisma_js_1.default.systemSettings.findUnique({ where: { id: 'default' } });
        if (!settings) {
            await prisma_js_1.default.systemSettings.create({
                data: { id: 'default', siteName: 'EventPeepo' },
            });
            console.log('✅ System settings initialized');
        }
        // Create default email provider from environment variables if none exists
        const emailProviderCount = await prisma_js_1.default.emailProvider.count();
        const smtpHost = process.env.DEFAULT_EMAIL_HOST || process.env.SMTP_HOST;
        const smtpPort = process.env.DEFAULT_EMAIL_PORT || process.env.SMTP_PORT || '587';
        const smtpUser = process.env.DEFAULT_EMAIL_USER || process.env.SMTP_USER;
        const smtpPass = process.env.DEFAULT_EMAIL_PASS || process.env.SMTP_PASS;
        const fromEmail = process.env.DEFAULT_EMAIL_FROM || process.env.SMTP_FROM || smtpUser;
        if (emailProviderCount === 0 && smtpHost && smtpUser) {
            console.log('🌱 Creating default email provider from environment variables...');
            await prisma_js_1.default.emailProvider.create({
                data: {
                    name: 'Default SMTP',
                    provider: 'smtp',
                    smtpHost: smtpHost,
                    smtpPort: parseInt(smtpPort),
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
            await prisma_js_1.default.systemSettings.update({
                where: { id: 'default' },
                data: { emailEnabled: true },
            });
            console.log('✅ Email service enabled in system settings');
        }
        else if (emailProviderCount === 0) {
            console.log('ℹ️  No email provider configured. Set SMTP_HOST and SMTP_USER (or DEFAULT_EMAIL_*) to enable email notifications.');
        }
        else {
            const hasActiveProvider = await prisma_js_1.default.emailProvider.findFirst({
                where: { isActive: true, isDefault: true },
            });
            if (hasActiveProvider && settings && !settings.emailEnabled) {
                console.log('🌱 Enabling email service (provider exists but was disabled)...');
                await prisma_js_1.default.systemSettings.update({
                    where: { id: 'default' },
                    data: { emailEnabled: true },
                });
                console.log('✅ Email service enabled');
            }
            else if (hasActiveProvider && settings?.emailEnabled) {
                console.log('✅ Email service is enabled and provider is configured');
            }
        }
        // Create sample event if none exist
        const eventCount = await prisma_js_1.default.event.count();
        if (eventCount === 0) {
            console.log('🌱 Creating sample event...');
            const event = await prisma_js_1.default.event.create({
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
                },
            });
            console.log('✅ Sample event created: ' + event.slug);
            if (event.ownerAccessToken) {
                console.log('   Event Owner Portal: /event-owner/' + event.ownerAccessToken);
            }
        }
    }
    catch (error) {
        console.error('Database initialization error:', error);
    }
}
// Routes
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const events_js_1 = __importDefault(require("./routes/events.js"));
const templates_js_1 = __importDefault(require("./routes/templates.js"));
const rsvp_js_1 = __importDefault(require("./routes/rsvp.js"));
const invitations_js_1 = __importDefault(require("./routes/invitations.js"));
const checkin_js_1 = __importDefault(require("./routes/checkin.js"));
const guestbook_js_1 = __importDefault(require("./routes/guestbook.js"));
const media_js_1 = __importDefault(require("./routes/media.js"));
const event_owner_js_1 = __importDefault(require("./routes/event-owner.js"));
const public_js_1 = __importDefault(require("./routes/public.js"));
const settings_js_1 = __importDefault(require("./routes/settings.js"));
const ticketing_js_1 = __importDefault(require("./routes/ticketing.js"));
const payment_gateways_js_1 = __importDefault(require("./routes/payment-gateways.js"));
const promo_codes_js_1 = __importDefault(require("./routes/promo-codes.js"));
const owners_js_1 = __importDefault(require("./routes/owners.js"));
const owner_auth_js_1 = __importDefault(require("./routes/owner-auth.js"));
const owner_dashboard_js_1 = __importDefault(require("./routes/owner-dashboard.js"));
const itinerary_js_1 = __importDefault(require("./routes/itinerary.js"));
const gifting_js_1 = __importDefault(require("./routes/gifting.js"));
const whatsapp_webhooks_js_1 = __importDefault(require("./routes/whatsapp-webhooks.js"));
// Middleware
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const requestLogger_js_1 = require("./middleware/requestLogger.js");
const auth_js_2 = require("./middleware/auth.js");
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 10000;
// Trust proxy (required for rate limiting behind reverse proxy like Render)
app.set('trust proxy', 1);
// Request Compression (gzip)
app.use((0, compression_1.default)());
// Security Middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
}));
// ═══════════════════════════════════════════════════════════════════════════════
// CORS Configuration — FIXED: single unified allowedOrigins, no duplicate
// ═══════════════════════════════════════════════════════════════════════════════
const siteUrl_js_1 = require("./utils/siteUrl.js");
const allowedOrigins = [
    (0, siteUrl_js_1.getSiteUrl)(),
    'https://digiguestbook.netlify.app',
    'https://app.eventpeepo.com',
    // Include any comma-separated values from CORS_ORIGIN
    ...(process.env.CORS_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean),
    process.env.FRONTEND_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
].filter(Boolean);
// Add localhost only in development
if (process.env.NODE_ENV === 'development') {
    allowedOrigins.push('http://localhost:3000');
}
// Deduplicate
const uniqueOrigins = [...new Set(allowedOrigins)];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin)
            return callback(null, true);
        if (uniqueOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Allow any *.eventpeepo.com subdomain
        try {
            if (/\.eventpeepo\.com$/.test(new URL(origin).hostname)) {
                return callback(null, true);
            }
        }
        catch {
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
const limiter = (0, express_rate_limit_1.default)({
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
const authLimiter = (0, express_rate_limit_1.default)({
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
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request Logging
app.use(requestLogger_js_1.requestLogger);
// Simple root endpoint for Render.com port detection
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'EventPeepo API',
        timestamp: new Date().toISOString()
    });
});
// Static Files (uploads, generated PDFs, templates)
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/generated', express_1.default.static(path_1.default.join(process.cwd(), 'generated')));
app.use('/templates', express_1.default.static(path_1.default.join(process.cwd(), 'templates')));
// Enhanced Health Check with comprehensive status
app.get('/health', async (req, res) => {
    const healthStatus = {
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
        const fsChecks = {};
        const requiredDirs = ['uploads/media', 'generated/reels', 'templates/archives', 'data'];
        for (const dir of requiredDirs) {
            const dirPath = path_1.default.join(process.cwd(), dir);
            try {
                fs_1.default.accessSync(dirPath, fs_1.default.constants.F_OK | fs_1.default.constants.W_OK);
                fsChecks[dir] = { status: 'pass', writable: true };
            }
            catch {
                try {
                    fs_1.default.mkdirSync(dirPath, { recursive: true });
                    fsChecks[dir] = { status: 'pass', writable: true, created: true };
                }
                catch {
                    fsChecks[dir] = { status: 'fail', writable: false };
                }
            }
        }
        healthStatus.checks.filesystem = fsChecks;
        try {
            const { spawn } = await import('child_process');
            const ffmpegCheck = spawn('ffmpeg', ['-version']);
            await new Promise((resolve, reject) => {
                ffmpegCheck.on('close', (code) => {
                    if (code === 0)
                        resolve();
                    else
                        reject(new Error('FFmpeg not available'));
                });
                ffmpegCheck.on('error', reject);
                setTimeout(() => reject(new Error('FFmpeg check timeout')), 2000);
            });
            healthStatus.services.ffmpeg = 'available';
            healthStatus.checks.ffmpeg = { status: 'pass' };
        }
        catch {
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
        const hasFailures = allChecks.some((check) => check.status === 'fail');
        healthStatus.status = hasFailures ? (dbHealthy ? 'degraded' : 'unhealthy') : 'healthy';
        const statusCode = healthStatus.status === 'healthy' ? 200 : healthStatus.status === 'degraded' ? 200 : 503;
        res.status(statusCode).json(healthStatus);
    }
    catch (error) {
        healthStatus.status = 'unhealthy';
        healthStatus.error = error.message;
        res.status(503).json(healthStatus);
    }
});
// Detailed Health Check (for internal monitoring)
app.get('/health/detailed', auth_js_2.authenticateAdmin, async (req, res) => {
    try {
        const { checkDatabaseHealth } = await import('./utils/prisma.js');
        const dbHealthy = await checkDatabaseHealth();
        const [eventCount, rsvpCount, mediaCount, templateCount] = await Promise.all([
            prisma_js_1.default.event.count(),
            prisma_js_1.default.rSVP.count(),
            prisma_js_1.default.mediaAsset.count(),
            prisma_js_1.default.template.count(),
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
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
        });
    }
});
// API Routes
app.use('/api/auth', auth_js_1.default);
app.use('/api/admin', admin_js_1.default);
app.use('/api/events', events_js_1.default);
app.use('/api/templates', templates_js_1.default);
app.use('/api/rsvp', rsvp_js_1.default);
app.use('/api/invitations', invitations_js_1.default);
app.use('/api/checkin', checkin_js_1.default);
app.use('/api/guestbook', guestbook_js_1.default);
app.use('/api/media', media_js_1.default);
app.use('/api/event-owner', event_owner_js_1.default);
app.use('/api/public', public_js_1.default);
app.use('/api/settings', settings_js_1.default);
app.use('/api/ticketing', ticketing_js_1.default);
app.use('/api/payment-gateways', payment_gateways_js_1.default);
app.use('/api/promo-codes', promo_codes_js_1.default);
app.use('/api/owners', owners_js_1.default);
app.use('/api/owner-auth', owner_auth_js_1.default);
app.use('/api/owner-dashboard', owner_dashboard_js_1.default);
app.use('/api/itinerary', itinerary_js_1.default);
app.use('/api/gifting', gifting_js_1.default);
app.use('/api/whatsapp', whatsapp_webhooks_js_1.default);
// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Global Error Handler
app.use(errorHandler_js_1.errorHandler);
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
    server.on('error', (error) => {
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
}
catch (error) {
    console.error('[Server] ❌ Fatal error during server startup:', error);
    console.error('[Server] ❌ Stack trace:', error.stack);
    process.exit(1);
}
exports.default = app;
//# sourceMappingURL=index.js.map