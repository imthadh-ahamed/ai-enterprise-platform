import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { retrieveChunks } from '../pipeline/retrieval'
import { logger } from '../lib/logger'

export const retrieveRouter = Router()

const RetrieveSchema = z.object({
  query: z.string().min(1),
  tenantId: z.string(),
  topK: z.number().int().min(1).max(50).default(10),
  rerankTopK: z.number().int().min(1).max(20).default(5),
})

retrieveRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = RetrieveSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() })
    return
  }

  try {
    const chunks = await retrieveChunks(parsed.data)
    const citations = chunks.map(c => ({
      documentId: c.documentId,
      documentTitle: c.documentTitle,
      pageNumber: c.pageNumber,
      excerpt: c.content.slice(0, 200),
      score: c.score,
    }))
    res.json({ chunks, citations })
  } catch (err) {
    logger.error({ err }, 'Retrieval failed')
    res.status(500).json({ error: 'Retrieval failed' })
  }
})
