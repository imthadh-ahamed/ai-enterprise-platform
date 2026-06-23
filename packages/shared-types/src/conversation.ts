import { z } from 'zod'

export const MessageRole = z.enum(['user', 'assistant', 'system', 'tool'])
export type MessageRole = z.infer<typeof MessageRole>

export const MessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: MessageRole,
  content: z.string(),
  citations: z.array(z.unknown()),
  agentPath: z.array(z.string()),
  tokenUsage: z.object({ input: z.number(), output: z.number() }),
  latencyMs: z.number().int().nullable(),
  createdAt: z.string().datetime(),
})
export type Message = z.infer<typeof MessageSchema>

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string(),
  model: z.string(),
  isArchived: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messages: z.array(MessageSchema).optional(),
})
export type Conversation = z.infer<typeof ConversationSchema>
