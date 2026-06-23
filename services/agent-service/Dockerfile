# ── Stage 1: deps ────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY services/agent-service/package.json ./services/agent-service/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @platform/agent-service...

# ── Stage 2: builder ─────────────────────────────────────────
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/agent-service/node_modules ./services/agent-service/node_modules
COPY . .
RUN pnpm --filter @platform/agent-service run build

# ── Stage 3: development ──────────────────────────────────────
FROM node:22-alpine AS development
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/agent-service/node_modules ./services/agent-service/node_modules
COPY . .
ENV NODE_ENV=development
EXPOSE 3002
CMD ["pnpm", "--filter", "@platform/agent-service", "dev"]

# ── Stage 4: runner ───────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache dumb-init
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nodeuser
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder --chown=nodeuser:nodejs /app/services/agent-service/dist ./dist
COPY --from=builder --chown=nodeuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodejs /app/services/agent-service/node_modules ./agent_node_modules
USER nodeuser
EXPOSE 3002
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
