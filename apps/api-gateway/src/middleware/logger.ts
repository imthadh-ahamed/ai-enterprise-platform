import morgan from 'morgan'
import { logger } from '../lib/logger'
import { v4 as uuidv4 } from 'uuid'
import type { Request, Response, NextFunction } from 'express'

const stream = { write: (msg: string) => logger.info(msg.trim()) }

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4()
  morgan(':method :url :status :res[content-length] - :response-time ms', { stream })(req, res, next)
}
