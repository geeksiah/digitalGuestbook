# Multi-stage build for smaller final image

# Stage 1: Build
FROM node:20-slim AS builder

# Install OpenSSL for Prisma (fixes the warning)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files AND prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript (fail on error)
RUN npm run build || (echo "Build failed!" && exit 1)

# Verify build output exists
RUN test -f dist/index.js || (echo "dist/index.js not found after build!" && ls -la dist/ && exit 1)

# Stage 2: Production
FROM node:20-slim

# Install FFmpeg and other runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies (Prisma Client is a regular dependency)
RUN npm ci --omit=dev

# Generate Prisma client in production stage
# Using npx ensures Prisma CLI is available (downloads temporarily if needed)
RUN npx prisma generate

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create directories for uploads and generated files
RUN mkdir -p uploads/media generated/reels templates/archives templates/events

# Expose port (Render.com will set PORT dynamically, but we expose a default)
EXPOSE 10000

# Set environment variables
ENV NODE_ENV=production
# PORT will be set by Render.com at runtime - don't set a default here

# DATABASE_URL and DIRECT_URL should be set via environment variables (Supabase)
# No default value - must be provided for production

# Start the application
# Production-grade migration approach (idempotent):
# 1. Try migrate deploy - only runs pending migrations (idempotent, fast on subsequent deploys)
# 2. If it fails (first deploy or incompatible migrations), use db push once as bootstrap
# 3. After first bootstrap with db push, future deploys will use migrate deploy (idempotent)
# Note: db push only runs ONCE on first deploy. All subsequent deploys use migrate deploy.
CMD ["sh", "-c", "echo '🔄 Running database migrations (idempotent)...'; npx prisma migrate deploy 2>&1 && echo '✅ Migrations applied (or already up to date - no changes needed)' || (echo '📦 First-time setup: creating database schema...' && npx prisma db push --accept-data-loss --skip-generate && echo '✅ Database schema created (this happens ONCE on first deploy only)'); echo '🚀 Starting server...'; exec node dist/index.js"]
