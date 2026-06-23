import express from 'express'
import { toolRegistry } from './registry/tool-registry'
import { mcpAuthMiddleware } from './middleware/mcp-auth'
import { toolRouter } from './routes/tools'
import { healthRouter } from './routes/health'
import { logger } from './lib/logger'

const app = express()
app.use(express.json({ limit: '50mb' }))

// MCP Gateway only accepts internal service-to-service calls
app.use(mcpAuthMiddleware)

app.use('/health', healthRouter)
app.use('/api/v1/tools', toolRouter)

// List all registered tools
app.get('/api/v1/tools', (_req, res) => {
  res.json({ tools: toolRegistry.listTools() })
})

const PORT = process.env.MCP_GATEWAY_PORT || 3006
app.listen(PORT, () => logger.info({ port: PORT }, 'MCP Gateway started'))
