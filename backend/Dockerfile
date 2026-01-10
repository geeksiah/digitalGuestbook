# Multi-stage build for smaller final image

# Stage 1: Build
FROM node:20-slim AS builder

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
# Note: For SQLite persistence, use a mounted volume for /app/data
RUN mkdir -p uploads/media generated/reels data templates/archives templates/events

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Use mounted volume for SQLite database if DATABASE_URL is file: URL
# Otherwise use environment-provided DATABASE_URL (PostgreSQL, etc.)
ENV DATABASE_URL=${DATABASE_URL:-"file:./data/prod.db"}

# Start the application
CMD ["npm", "run", "start:prod"]
