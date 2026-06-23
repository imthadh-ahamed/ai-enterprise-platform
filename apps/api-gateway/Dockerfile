# ── Stage 1: deps ────────────────────────────────────────────
FROM node:26-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api-gateway/package.json ./apps/api-gateway/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/
RUN pnpm install --frozen-lockfile --filter @platform/api-gateway...

# ── Stage 2: builder ─────────────────────────────────────────
FROM node:26-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY . .
RUN pnpm --filter @platform/api-gateway run build

# ── Stage 3: development ──────────────────────────────────────
FROM node:26-alpine AS development
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api-gateway/node_modules ./apps/api-gateway/node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["pnpm", "--filter", "@platform/api-gateway", "dev"]

# ── Stage 4: runner ───────────────────────────────────────────
FROM node:26-alpine AS runner
RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeuser
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nodeuser:nodejs /app/apps/api-gateway/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
USER nodeuser
EXPOSE 3000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
