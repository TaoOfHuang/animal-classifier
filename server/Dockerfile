# ── Build Stage ─────────────────────────────────────────────────────
# 必须是 Node 22+：数据层用的是内置的 node:sqlite（Node 22.5 起提供）
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files first (cache layer)
COPY package.json package-lock.json* ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ── Production Stage ────────────────────────────────────────────────
FROM node:22-alpine AS production

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy env example (not the real .env — set via env vars)
COPY .env.example .env

# SQLite 数据目录。提前建好并授权给 appuser，否则挂载卷后非 root 用户无法写入。
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

# Switch to non-root user
USER appuser

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
