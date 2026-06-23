import express from 'express'
import { authRouter } from './routes/auth'
import { usersRouter } from './routes/users'
import { healthRouter } from './routes/health'
import { errorHandler } from './middleware/error-handler'
import { logger } from './lib/logger'

const app = express()
app.use(express.json({ limit: '1mb' }))

app.use('/health', healthRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/users', usersRouter)
app.use(errorHandler)

const PORT = process.env.AUTH_SERVICE_PORT || 3001
app.listen(PORT, () => logger.info({ port: PORT }, 'Auth service started'))
