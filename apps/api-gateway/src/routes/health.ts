import { Router } from 'express'
import { redis } from '../lib/redis'
import { db } from '../lib/db'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, string> = { api_gateway: 'ok' }

  try {
    await redis.ping()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
  }

  try {
    await db.query('SELECT 1')
    checks.postgres = 'ok'
  } catch {
    checks.postgres = 'error'
  }

  const allOk = Object.values(checks).every(v => v === 'ok')
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
  })
})
