import { redis } from '../../lib/redis'
import type { AgentStateType } from '../orchestrator'
import { logger } from '../../lib/logger'

const MEMORY_TTL = 60 * 60 * 24 // 24h

export async function memoryManager(state: AgentStateType) {
  const key = `memory:${state.tenantId}:${state.userId}`

  try {
    const stored = await redis.get(key)
    const previousMessages = stored ? JSON.parse(stored) : []

    // Store updated context
    const updatedMessages = [...previousMessages, { role: 'user', content: state.userQuery }].slice(-20) // keep last 20
    await redis.setex(key, MEMORY_TTL, JSON.stringify(updatedMessages))

    return { context: { previousMessages } }
  } catch (err) {
    logger.error({ err }, 'Memory manager error — continuing without memory')
    return {}
  }
}
