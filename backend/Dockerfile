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

# Copy source code (before generating Prisma client to ensure schema is latest)
COPY . .

# Generate Prisma client (must happen after all files are copied and before TypeScript build)
# This ensures the Prisma client includes all models from the schema
RUN npx prisma generate || (echo "Prisma generate failed!" && exit 1)

# Verify Prisma client was generated
RUN test -d node_modules/.prisma/client || (echo "Prisma client not found after generation!" && exit 1)

# Build TypeScript (fail on error)
# Note: package.json build script also runs prisma generate, but it's idempotent
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
# Production-grade: Use db push for now (idempotent, safe, fast)
# IMPORTANT: For Render.com (IPv4-only), use Session Pooler for both DATABASE_URL and DIRECT_URL
# Session Pooler (port 5432) supports schema operations, unlike Transaction Pooler (port 6543)
# Direct Connection (db.*.supabase.co) requires IPv6 and doesn't work on Render.com
# db push only applies changes when schema differs (idempotent)
# Safety: no --accept-data-loss, so destructive changes are blocked by Prisma
# Increased timeout to 90s for large schemas or slow connections
CMD ["sh", "-c", "echo 'Syncing database schema (non-destructive)...'; if [ -z \"$DIRECT_URL\" ]; then export DIRECT_URL=\"$DATABASE_URL\"; echo 'DIRECT_URL not set - falling back to DATABASE_URL'; fi; timeout 90 npx prisma db push --skip-generate 2>&1 && echo 'Schema synced (already up to date if no changes)' || (echo 'Schema sync skipped/failed. Destructive changes were NOT applied.'; echo 'Verify URLs use Session Pooler (port 5432) and review schema differences.'); echo 'Starting server...'; exec node dist/index.js"]
