import type { Request, Response, NextFunction } from 'express'
import { logger } from '../lib/logger'

export function errorHandler(
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = err.status || 500
  logger.error({ err, path: req.path }, 'Unhandled error')
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message })
}
