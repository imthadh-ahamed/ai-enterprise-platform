import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { rateLimiter } from './middleware/rate-limiter'
import { authMiddleware } from './middleware/auth'
import { requestLogger } from './middleware/logger'
import { errorHandler } from './middleware/error-handler'
import { tenantMiddleware } from './middleware/tenant'
import { healthRouter } from './routes/health'
import { logger } from './lib/logger'

const app = express()
const httpServer = createServer(app)

// WebSocket server for real-time agent streaming
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.CORS_ORIGIN, credentials: true },
  path: '/ws',
})

// ── Security ────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // handled by Next.js
  crossOriginEmbedderPolicy: false,
}))
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3100',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// ── Global middleware ────────────────────────────────────────
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(requestLogger)
app.use(rateLimiter)
app.use(tenantMiddleware)

// ── Public routes ─────────────────────────────────────────
app.use('/health', healthRouter)
app.use('/api/v1/auth', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/v1/auth': '/api/v1/auth' },
}))

// ── Protected routes ──────────────────────────────────────
app.use('/api/v1', authMiddleware)

app.use('/api/v1/agent', createProxyMiddleware({
  target: process.env.AGENT_SERVICE_URL || 'http://agent-service:3002',
  changeOrigin: true,
  on: { proxyReq: (pr, req) => { pr.setHeader('X-User-ID', (req as express.Request & { user?: { id: string } }).user?.id || '') } },
}))

app.use('/api/v1/rag', createProxyMiddleware({
  target: process.env.RAG_SERVICE_URL || 'http://rag-service:3003',
  changeOrigin: true,
}))

app.use('/api/v1/documents', createProxyMiddleware({
  target: process.env.DOCUMENT_SERVICE_URL || 'http://document-service:3004',
  changeOrigin: true,
}))

app.use('/api/v1/mcp', createProxyMiddleware({
  target: process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:3006',
  changeOrigin: true,
}))

app.use('/api/v1/users', createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  changeOrigin: true,
}))

// ── Chat streaming (SSE) ───────────────────────────────────
app.use('/api/chat', authMiddleware, createProxyMiddleware({
  target: process.env.AGENT_SERVICE_URL || 'http://agent-service:3002',
  changeOrigin: true,
  on: {
    proxyRes: (proxyRes) => {
      proxyRes.headers['cache-control'] = 'no-cache'
      proxyRes.headers['x-accel-buffering'] = 'no'
    },
  },
}))

// ── WebSocket relay ────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) return next(new Error('Authentication required'))
  next()
})

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'WebSocket client connected')
  socket.on('disconnect', () => logger.info({ socketId: socket.id }, 'WebSocket client disconnected'))
})

// ── Error handler (must be last) ──────────────────────────
app.use(errorHandler)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  logger.info({ port: PORT }, 'API Gateway started')
})

export { io }
