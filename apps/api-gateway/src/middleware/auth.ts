import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../lib/logger'

interface JwtPayload {
  sub: string
  email: string
  role: string
  tenantId: string
  iat: number
  exp: number
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' })
    return
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    req.headers['x-user-id'] = payload.sub
    req.headers['x-user-email'] = payload.email
    req.headers['x-user-role'] = payload.role
    req.headers['x-tenant-id'] = payload.tenantId
    next()
  } catch (err) {
    logger.warn({ err }, 'JWT verification failed')
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
