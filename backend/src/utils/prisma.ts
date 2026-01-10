import { PrismaClient } from '@prisma/client';

// Singleton pattern for Prisma Client with production-grade configuration
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    errorFormat: process.env.NODE_ENV === 'development' ? 'pretty' : 'minimal',
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

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
const shutdown = async () => {
  console.log('[Database] Disconnecting...');
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('beforeExit', shutdown);

// Health check function for use in health endpoint
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export default prisma;
