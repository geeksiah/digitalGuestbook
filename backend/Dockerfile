# Use Node.js with FFmpeg support
FROM node:20-slim

# Install FFmpeg and other dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files AND prisma schema first (needed for postinstall)
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (this will run postinstall which needs prisma schema)
RUN npm ci --omit=dev

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build TypeScript
RUN npm run build

# Create directories for uploads and generated files
RUN mkdir -p uploads/media generated/reels data

# Expose port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Start the application
CMD ["npm", "run", "start:prod"]
