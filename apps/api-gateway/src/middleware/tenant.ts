import type { Request, Response, NextFunction } from 'express'

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const tenantId =
    req.headers['x-tenant-id'] ||
    req.hostname.split('.')[0] // subdomain-based tenant resolution
  if (tenantId) req.headers['x-tenant-id'] = tenantId as string
  next()
}
