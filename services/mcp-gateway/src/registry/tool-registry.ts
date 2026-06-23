import { z } from 'zod'
import { githubTools } from '../tools/github'
import { jiraTools } from '../tools/jira'
import { postgresTools } from '../tools/postgres'
import { slackTools } from '../tools/slack'
import { s3Tools } from '../tools/s3'
import { logger } from '../lib/logger'

export interface MCPTool {
  name: string
  description: string
  inputSchema: z.ZodSchema
  handler: (params: unknown, context: ToolContext) => Promise<unknown>
}

export interface ToolContext {
  tenantId: string
  userId: string
}

class ToolRegistry {
  private tools = new Map<string, MCPTool>()

  register(tool: MCPTool): void {
    this.tools.set(tool.name, tool)
    logger.info({ tool: tool.name }, 'MCP tool registered')
  }

  get(name: string): MCPTool | undefined {
    return this.tools.get(name)
  }

  listTools(): Pick<MCPTool, 'name' | 'description'>[] {
    return Array.from(this.tools.values()).map(({ name, description }) => ({ name, description }))
  }

  async call(name: string, params: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) throw new Error(`Unknown tool: ${name}`)

    const parsed = tool.inputSchema.parse(params)
    logger.info({ tool: name, tenantId: context.tenantId }, 'MCP tool called')

    return tool.handler(parsed, context)
  }
}

export const toolRegistry = new ToolRegistry()

// Register all tools
;[...githubTools, ...jiraTools, ...postgresTools, ...slackTools, ...s3Tools].forEach(t =>
  toolRegistry.register(t),
)
