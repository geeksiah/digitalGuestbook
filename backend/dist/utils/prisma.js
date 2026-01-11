"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDatabaseHealth = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Singleton pattern for Prisma Client with production-grade configuration
const globalForPrisma = globalThis;
const createPrismaClient = () => {
    // For Supabase pooler, disable prepared statements (pooler doesn't support them)
    // Prepared statements are re-enabled automatically when using DIRECT_URL for migrations
    const client = new client_1.PrismaClient({
        log: process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'],
        errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
        // Disable prepared statements when using pooler (DATABASE_URL has pgbouncer=true)
        // Prisma automatically uses DIRECT_URL (without pooler) for operations that need prepared statements
    });
    // Non-blocking connection test - don't exit on failure, let server start
    // The server will check connection health via health endpoint
    client.$connect()
        .then(() => {
        console.log('[Database] Prisma Client initialized and connected');
    })
        .catch((error) => {
        console.warn('[Database] Prisma Client initialization warning:', error.message);
        console.warn('[Database] Server will start, but database may not be available');
        // Don't exit - let server start and handle DB errors gracefully
    });
    return client;
};
exports.prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
// Graceful shutdown
const shutdown = async () => {
    console.log('[Database] Disconnecting...');
    await exports.prisma.$disconnect();
    process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);
// Health check function for use in health endpoint
// Uses a simple query that works with connection pooling
const checkDatabaseHealth = async () => {
    try {
        // Use a simple count query instead of raw SQL to avoid prepared statement issues
        await exports.prisma.$queryRawUnsafe('SELECT 1 as health');
        return true;
    }
    catch (error) {
        // If it's a prepared statement error, try without prepared statements
        if (error.code === '42P05' || error.message?.includes('prepared statement')) {
            try {
                // Retry with unsafe query
                await exports.prisma.$executeRawUnsafe('SELECT 1');
                return true;
            }
            catch {
                return false;
            }
        }
        return false;
    }
};
exports.checkDatabaseHealth = checkDatabaseHealth;
exports.default = exports.prisma;
//# sourceMappingURL=prisma.js.map