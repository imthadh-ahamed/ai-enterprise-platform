import { Router } from 'express'
import { db } from '../lib/db'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ok', service: 'rag-service' })
  } catch {
    res.status(503).json({ status: 'error', service: 'rag-service' })
  }
})
