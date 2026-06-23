import express from 'express'
import { retrieveRouter } from './routes/retrieve'
import { ingestRouter } from './routes/ingest'
import { healthRouter } from './routes/health'
import { errorHandler } from './middleware/error-handler'
import { logger } from './lib/logger'

const app = express()
app.use(express.json({ limit: '10mb' }))

app.use('/health', healthRouter)
app.use('/api/v1/retrieve', retrieveRouter)
app.use('/api/v1/ingest', ingestRouter)
app.use(errorHandler)

const PORT = process.env.RAG_SERVICE_PORT || 3003
app.listen(PORT, () => logger.info({ port: PORT }, 'RAG service started'))
