# Multi-stage Dockerfile for GreaseMonkey AI PWA
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build for production
RUN npm run build

# Development stage
FROM base AS development
WORKDIR /app

# Install dependencies for development
COPY package.json package-lock.json* ./
RUN npm install

# Copy source code
COPY . .

# Set development environment
ENV NODE_ENV=development

# Expose port
EXPOSE 3000

# Start development server with enhanced hot reload for Docker
# Use DEV_MODE env var to switch between modes: dev:poll (default), dev:webpack
CMD ["sh", "-c", "npm run ${DEV_MODE:-dev:poll}"]

# Production stage - lightweight runtime
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
