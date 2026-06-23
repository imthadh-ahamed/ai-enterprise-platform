import { Router, type Request, type Response } from 'express'
import { buildOrchestratorGraph } from '../graphs/orchestrator'
import { logger } from '../lib/logger'

export const chatRouter = Router()

// Vercel AI SDK-compatible streaming endpoint
chatRouter.post('/', async (req: Request, res: Response) => {
  const { messages, sessionId } = req.body
  const userId = req.headers['x-user-id'] as string
  const tenantId = req.headers['x-tenant-id'] as string

  if (!messages?.length) {
    res.status(400).json({ error: 'Messages array is required' })
    return
  }

  const userQuery = messages.at(-1)?.content || ''

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const graph = buildOrchestratorGraph()

    sendEvent('agent_start', { message: 'Starting agent execution...' })

    const stream = await graph.stream(
      {
        userQuery,
        userId: userId || 'anonymous',
        tenantId: tenantId || 'default',
        messages: messages.map((m: { role: string; content: string }) =>
          m.role === 'user'
            ? { _getType: () => 'human', content: m.content }
            : { _getType: () => 'ai', content: m.content },
        ),
      },
      { recursionLimit: 20, streamMode: 'updates' },
    )

    for await (const update of stream) {
      const [nodeName, nodeOutput] = Object.entries(update)[0] as [string, Record<string, unknown>]
      sendEvent('agent_update', { node: nodeName, ...nodeOutput })

      if (nodeOutput.finalAnswer) {
        sendEvent('text', { text: nodeOutput.finalAnswer })
        sendEvent('citations', { citations: nodeOutput.citations || [] })
      }
    }

    sendEvent('done', { sessionId })
    res.end()
  } catch (err) {
    logger.error({ err, userId, tenantId }, 'Chat stream error')
    sendEvent('error', { message: 'Agent execution failed' })
    res.end()
  }
})
