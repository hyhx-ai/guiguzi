# ─── Guiguzi Multi-Stage Docker Build ───
# Supports both amd64 and arm64 (for Raspberry Pi / ARM servers)

# ─── Stage 1: Build ───
FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

WORKDIR /app

# Copy dependency manifests first for layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/nova-ai/package.json          packages/nova-ai/package.json
COPY packages/nova-router/package.json      packages/nova-router/package.json
COPY packages/nova-agent-core/package.json  packages/nova-agent-core/package.json
COPY packages/nova-cli/package.json         packages/nova-cli/package.json
COPY packages/nova-tui/package.json         packages/nova-tui/package.json
COPY packages/nova-gateway/package.json     packages/nova-gateway/package.json
COPY packages/nova-web/package.json         packages/nova-web/package.json
COPY packages/nova-sdk/package.json         packages/nova-sdk/package.json

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY tsconfig.base.json tsconfig.json ./
COPY packages/ packages/

RUN pnpm build

# ─── Stage 2: Production ───
FROM node:22-slim AS production

LABEL org.opencontainers.image.title="Guiguzi Gateway"
LABEL org.opencontainers.image.description="AI Coding Agent with Intelligent Router - Multi-Channel Gateway"
LABEL org.opencontainers.image.licenses="MIT"

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# Create non-root user
RUN groupadd -r guiguzi && useradd -r -g guiguzi -d /app -s /sbin/nologin guiguzi

WORKDIR /app

# Copy built packages
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/nova-ai/dist          packages/nova-ai/dist
COPY --from=builder /app/packages/nova-ai/package.json   packages/nova-ai/package.json
COPY --from=builder /app/packages/nova-router/dist       packages/nova-router/dist
COPY --from=builder /app/packages/nova-router/package.json packages/nova-router/package.json
COPY --from=builder /app/packages/nova-agent-core/dist   packages/nova-agent-core/dist
COPY --from=builder /app/packages/nova-agent-core/package.json packages/nova-agent-core/package.json
COPY --from=builder /app/packages/nova-gateway/dist      packages/nova-gateway/dist
COPY --from=builder /app/packages/nova-gateway/package.json packages/nova-gateway/package.json
COPY --from=builder /app/packages/nova-web/dist          packages/nova-web/dist
COPY --from=builder /app/packages/nova-web/package.json   packages/nova-web/package.json
COPY --from=builder /app/packages/nova-cli/dist          packages/nova-cli/dist
COPY --from=builder /app/packages/nova-cli/package.json   packages/nova-cli/package.json
COPY --from=builder /app/packages/nova-tui/dist          packages/nova-tui/dist
COPY --from=builder /app/packages/nova-tui/package.json   packages/nova-tui/package.json
COPY --from=builder /app/packages/nova-sdk/dist          packages/nova-sdk/dist
COPY --from=builder /app/packages/nova-sdk/package.json   packages/nova-sdk/package.json

# Install production deps only
RUN pnpm install --prod --frozen-lockfile

# Data directories
RUN mkdir -p /var/lib/guiguzi /var/log/guiguzi && \
    chown -R guiguzi:guiguzi /app /var/lib/guiguzi /var/log/guiguzi

USER guiguzi

# Gateway port
EXPOSE 18789

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:18789/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Default: run gateway
CMD ["node", "packages/nova-gateway/dist/index.js"]
