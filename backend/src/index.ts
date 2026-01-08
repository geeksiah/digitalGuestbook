import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

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
import coupleRoutes from './routes/couple.js';
import publicRoutes from './routes/public.js';
import settingsRoutes from './routes/settings.js';

// Middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Allow templates to load resources
}));

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Couple-Token'],
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

// Static Files (uploads, generated PDFs)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/generated', express.static(path.join(__dirname, '../generated')));

// Health Check with database status
app.get('/health', async (req, res) => {
  try {
    const { checkDatabaseHealth } = await import('./utils/prisma.js');
    const dbHealthy = await checkDatabaseHealth();
    
    res.json({ 
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'running',
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
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

// Couple Portal
app.use('/api/couple', coupleRoutes);

// Public Event Pages
app.use('/api/public', publicRoutes);

// System Settings (admin only)
app.use('/api/settings', settingsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎉 Digital Event Platform API                               ║
║                                                               ║
║   Server running on: http://localhost:${PORT}                   ║
║   Environment: ${process.env.NODE_ENV || 'development'}                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
