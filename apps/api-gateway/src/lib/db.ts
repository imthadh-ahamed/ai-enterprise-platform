import { Pool } from 'pg'
import { logger } from './logger'

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

db.on('error', (err) => logger.error({ err }, 'DB pool error'))
