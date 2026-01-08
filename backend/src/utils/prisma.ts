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

  // Connection test
  client.$connect()
    .then(() => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Database] Connected successfully');
      }
    })
    .catch((error) => {
      console.error('[Database] Connection failed:', error.message);
      process.exit(1);
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
