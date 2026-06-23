import express from 'express'
import { createServer } from 'http'
import { agentRouter } from './routes/agent'
import { chatRouter } from './routes/chat'
import { healthRouter } from './routes/health'
import { errorHandler } from './middleware/error-handler'
import { logger } from './lib/logger'

const app = express()
const httpServer = createServer(app)

app.use(express.json({ limit: '10mb' }))

app.use('/health', healthRouter)
app.use('/api/v1/agent', agentRouter)
app.use('/api/chat', chatRouter)

app.use(errorHandler)

const PORT = process.env.AGENT_SERVICE_PORT || 3002
httpServer.listen(PORT, () => logger.info({ port: PORT }, 'Agent service started'))
