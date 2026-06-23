# ── Stage 1: deps ────────────────────────────────────────────
FROM node:26-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-ui/package.json ./packages/shared-ui/
COPY packages/shared-utils/package.json ./packages/shared-utils/
RUN pnpm install --frozen-lockfile --filter @platform/frontend...

# ── Stage 2: builder ─────────────────────────────────────────
FROM node:26-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @platform/frontend run build

# ── Stage 3: development ──────────────────────────────────────
FROM node:26-alpine AS development
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/frontend/node_modules ./apps/frontend/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NODE_ENV=development
EXPOSE 3100
CMD ["pnpm", "--filter", "@platform/frontend", "dev"]

# ── Stage 4: production runner ────────────────────────────────
FROM node:26-alpine AS runner
RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public
USER nextjs
EXPOSE 3100
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/frontend/server.js"]
