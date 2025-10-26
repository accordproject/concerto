# Concerto Development and CLI Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Builder
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    g++

# Copy package files
COPY package*.json ./
COPY packages ./packages

# Install dependencies
RUN npm ci --ignore-scripts

# Build all workspaces
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    git \
    tini

# Create non-root user for security
RUN addgroup -g 1001 -S concerto && \
    adduser -u 1001 -S concerto -G concerto

# Copy built artifacts from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/node_modules ./node_modules

# Set ownership
RUN chown -R concerto:concerto /app

# Switch to non-root user
USER concerto

# Set environment variables
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn

# Health check (optional - for CLI tools this may not be needed)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
#   CMD node --version || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command - can be overridden
CMD ["node", "--version"]

# Labels for metadata
LABEL maintainer="accordproject.org"
LABEL org.opencontainers.image.title="Concerto"
LABEL org.opencontainers.image.description="A lightweight schema language and runtime for business concepts"
LABEL org.opencontainers.image.url="https://www.accordproject.org/"
LABEL org.opencontainers.image.source="https://github.com/accordproject/concerto"
LABEL org.opencontainers.image.version="3.24.0"
LABEL org.opencontainers.image.licenses="Apache-2.0"
