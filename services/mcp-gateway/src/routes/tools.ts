import { Router, type Request, type Response } from 'express'
import { toolRegistry } from '../registry/tool-registry'
import { logger } from '../lib/logger'

export const toolRouter = Router()

toolRouter.get('/', (_req, res) => {
  res.json({ tools: toolRegistry.listTools() })
})

toolRouter.post('/call', async (req: Request, res: Response): Promise<void> => {
  const { tool, params } = req.body
  const tenantId = req.headers['x-tenant-id'] as string || 'default'
  const userId = req.headers['x-user-id'] as string || 'system'

  if (!tool) { res.status(400).json({ error: 'tool is required' }); return }

  try {
    const result = await toolRegistry.call(tool, params, { tenantId, userId })
    res.json({ success: true, data: result })
  } catch (err) {
    logger.error({ err, tool }, 'MCP tool call failed')
    res.status(500).json({ success: false, error: (err as Error).message })
  }
})
