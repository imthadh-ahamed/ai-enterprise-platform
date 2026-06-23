import { z } from 'zod'

export const AgentIntent = z.enum([
  'rag_query',
  'document_search',
  'sql_query',
  'data_analysis',
  'create_ticket',
  'send_message',
  'trigger_workflow',
  'generate_report',
  'general_chat',
])
export type AgentIntent = z.infer<typeof AgentIntent>

export const AgentExecutionStatus = z.enum(['running', 'completed', 'failed', 'awaiting_approval'])
export type AgentExecutionStatus = z.infer<typeof AgentExecutionStatus>

export const AgentExecutionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  threadId: z.string(),
  intent: AgentIntent.nullable(),
  agentPath: z.array(z.string()),
  status: AgentExecutionStatus,
  tokenUsage: z.object({ input: z.number(), output: z.number() }),
  latencyMs: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
})
export type AgentExecution = z.infer<typeof AgentExecutionSchema>
