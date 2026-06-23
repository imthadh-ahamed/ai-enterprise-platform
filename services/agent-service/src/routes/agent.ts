import { Router, type Request, type Response } from 'express'
import { buildOrchestratorGraph } from '../graphs/orchestrator'
import { logger } from '../lib/logger'

export const agentRouter = Router()

// GET /api/v1/agent/executions — list recent executions (stub)
agentRouter.get('/executions', (_req: Request, res: Response) => {
  res.json({ executions: [], total: 0 })
})

// POST /api/v1/agent/run — run agent synchronously (non-streaming)
agentRouter.post('/run', async (req: Request, res: Response): Promise<void> => {
  const { query } = req.body
  const userId = req.headers['x-user-id'] as string || 'anonymous'
  const tenantId = req.headers['x-tenant-id'] as string || 'default'

  if (!query) {
    res.status(400).json({ error: 'query is required' })
    return
  }

  try {
    const graph = buildOrchestratorGraph()
    const result = await graph.invoke({
      userQuery: query,
      userId,
      tenantId,
      messages: [],
    })
    res.json({ answer: result.finalAnswer, citations: result.citations, agentPath: result.agentPath })
  } catch (err) {
    logger.error({ err }, 'Agent run failed')
    res.status(500).json({ error: 'Agent execution failed' })
  }
})
