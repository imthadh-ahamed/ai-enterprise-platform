import { Router, type Request, type Response } from 'express'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../lib/db'
import { redis } from '../lib/redis'
import { logger } from '../lib/logger'

export const authRouter = Router()

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  tenantSlug: z.string().optional(),
})

const RegisterSchema = LoginSchema.extend({
  name: z.string().min(2).max(100),
  tenantSlug: z.string().min(2).max(50),
})

function signTokens(userId: string, email: string, role: string, tenantId: string) {
  const accessToken = jwt.sign(
    { sub: userId, email, role, tenantId },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' },
  )
  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  )
  return { accessToken, refreshToken }
}

authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  const { email, password } = parsed.data
  const result = await db.query(
    `SELECT u.id, u.password_hash, u.role, u.name, u.is_active, u.tenant_id
     FROM users u JOIN tenants t ON t.id = u.tenant_id
     WHERE u.email = $1 AND t.is_active = TRUE`,
    [email.toLowerCase()],
  )

  const user = result.rows[0]
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await argon2.verify(user.password_hash, password)
  if (!valid) {
    logger.warn({ email }, 'Failed login attempt')
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  await db.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])

  const { accessToken, refreshToken } = signTokens(user.id, email, user.role, user.tenant_id)

  // Store refresh token hash in Redis
  const tokenHash = Buffer.from(refreshToken).toString('base64').slice(0, 64)
  await redis.setex(`rt:${tokenHash}`, 7 * 24 * 3600, user.id)

  res.json({ accessToken, refreshToken, user: { id: user.id, email, name: user.name, role: user.role } })
})

authRouter.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  const { email, password, name, tenantSlug } = parsed.data

  const tenant = await db.query(`SELECT id FROM tenants WHERE slug = $1 AND is_active = TRUE`, [tenantSlug])
  if (!tenant.rows[0]) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  const existing = await db.query(`SELECT id FROM users WHERE email = $1 AND tenant_id = $2`, [email, tenant.rows[0].id])
  if (existing.rows[0]) {
    res.status(409).json({ error: 'User already exists' })
    return
  }

  const passwordHash = await argon2.hash(password)
  const userId = uuidv4()

  await db.query(
    `INSERT INTO users (id, tenant_id, email, name, password_hash, role) VALUES ($1, $2, $3, $4, $5, 'user')`,
    [userId, tenant.rows[0].id, email.toLowerCase(), name, passwordHash],
  )

  const { accessToken, refreshToken } = signTokens(userId, email, 'user', tenant.rows[0].id)
  res.status(201).json({ accessToken, refreshToken, user: { id: userId, email, name, role: 'user' } })
})

authRouter.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' })
    return
  }

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!) as { sub: string; type: string }
    if (payload.type !== 'refresh') throw new Error('Invalid token type')

    const tokenHash = Buffer.from(refreshToken).toString('base64').slice(0, 64)
    const stored = await redis.get(`rt:${tokenHash}`)
    if (!stored) {
      res.status(401).json({ error: 'Refresh token expired or revoked' })
      return
    }

    const user = await db.query(`SELECT id, email, role, tenant_id FROM users WHERE id = $1`, [payload.sub])
    if (!user.rows[0]) {
      res.status(401).json({ error: 'User not found' })
      return
    }

    const u = user.rows[0]
    const tokens = signTokens(u.id, u.email, u.role, u.tenant_id)
    res.json(tokens)
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' })
  }
})

authRouter.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body
  if (refreshToken) {
    const tokenHash = Buffer.from(refreshToken).toString('base64').slice(0, 64)
    await redis.del(`rt:${tokenHash}`)
  }
  res.json({ ok: true })
})
