# Multi-stage Dockerfile for Plato

# Stage 1: Build
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Runtime
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1000 plato && \
    adduser -D -u 1000 -G plato plato

# Set working directory
WORKDIR /app

# Copy built application and dependencies from builder
COPY --from=builder --chown=plato:plato /app/dist ./dist
COPY --from=builder --chown=plato:plato /app/node_modules ./node_modules
COPY --from=builder --chown=plato:plato /app/package*.json ./

# Copy necessary runtime files
COPY --chown=plato:plato scripts ./scripts
COPY --chown=plato:plato docs ./docs

# Create necessary directories with proper permissions
RUN mkdir -p /app/.plato /app/.plato/memory /app/.plato/commands /app/.plato/styles && \
    chown -R plato:plato /app/.plato

# Switch to non-root user
USER plato

# Expose port (if running as HTTP proxy)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PLATO_CONFIG_DIR=/app/.plato \
    PLATO_MEMORY_DIR=/app/.plato/memory

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Default command
CMD ["node", "dist/cli.js"]