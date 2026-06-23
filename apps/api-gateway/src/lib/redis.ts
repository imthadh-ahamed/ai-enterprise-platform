import Redis from 'ioredis'
import { logger } from './logger'

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error({ err }, 'Redis error'))
