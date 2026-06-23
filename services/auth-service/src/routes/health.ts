import { Router } from 'express'
import { db } from '../lib/db'
import { redis } from '../lib/redis'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, string> = {}
  try { await db.query('SELECT 1'); checks.postgres = 'ok' } catch { checks.postgres = 'error' }
  try { await redis.ping(); checks.redis = 'ok' } catch { checks.redis = 'error' }
  const allOk = Object.values(checks).every(v => v === 'ok')
  res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks })
})
