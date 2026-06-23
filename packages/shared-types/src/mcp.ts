import { z } from 'zod'

export const MCPToolCallSchema = z.object({
  tool: z.string(),
  params: z.record(z.unknown()),
  tenantId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
})
export type MCPToolCall = z.infer<typeof MCPToolCallSchema>

export const MCPToolResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})
export type MCPToolResult = z.infer<typeof MCPToolResultSchema>
