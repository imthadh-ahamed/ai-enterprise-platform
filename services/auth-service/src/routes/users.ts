import { Router, type Request, type Response } from 'express'
import { db } from '../lib/db'

export const usersRouter = Router()

// GET /api/v1/users/me — get current user profile
usersRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  const userId = req.headers['x-user-id'] as string
  if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return }

  const result = await db.query(
    'SELECT id, email, name, role, avatar_url, created_at FROM users WHERE id = $1',
    [userId],
  )
  if (!result.rows[0]) { res.status(404).json({ error: 'User not found' }); return }
  res.json({ user: result.rows[0] })
})

// GET /api/v1/users — list users (admin only)
usersRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.headers['x-tenant-id'] as string
  const role = req.headers['x-user-role'] as string
  if (role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return }

  const result = await db.query(
    'SELECT id, email, name, role, is_active, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at DESC',
    [tenantId],
  )
  res.json({ users: result.rows, total: result.rowCount })
})
