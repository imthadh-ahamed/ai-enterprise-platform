import rateLimit from 'express-rate-limit'

export const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    (req.headers['x-tenant-id'] as string) || req.ip || 'anonymous',
  handler: (_, res) => {
    res.status(429).json({ error: 'Too many requests' })
  },
})
