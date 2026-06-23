import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { ingestDocument } from '../pipeline/ingestion'
import { logger } from '../lib/logger'

export const ingestRouter = Router()

const IngestSchema = z.object({
  documentId: z.string().uuid(),
  tenantId: z.string(),
  content: z.string().min(1),
  title: z.string(),
  sourceType: z.enum(['pdf', 'docx', 'xlsx', 'txt', 'md', 'csv', 'url']),
  metadata: z.record(z.unknown()).optional(),
})

ingestRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = IngestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  res.json({ status: 'queued', documentId: parsed.data.documentId })

  // Run ingestion asynchronously after responding
  ingestDocument(parsed.data).catch(err =>
    logger.error({ err, documentId: parsed.data.documentId }, 'Ingestion failed'),
  )
})
