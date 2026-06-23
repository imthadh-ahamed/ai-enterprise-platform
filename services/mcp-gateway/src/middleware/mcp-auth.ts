import type { Request, Response, NextFunction } from 'express'

export function mcpAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth for health checks
  if (req.path === '/health' || req.path.startsWith('/health')) { next(); return }

  const authHeader = req.headers.authorization
  const secret = process.env.MCP_AUTH_SECRET

  // In local dev without a secret set, allow all
  if (!secret) { next(); return }

  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
