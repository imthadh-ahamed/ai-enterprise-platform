import { logger } from './logger'

interface MCPCallResult {
  data: unknown
  rowCount?: number
  error?: string
}

class MCPClient {
  private readonly baseUrl: string

  constructor() {
    this.baseUrl = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:3006'
  }

  async call(tool: string, params: Record<string, unknown>): Promise<MCPCallResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.MCP_AUTH_SECRET}`,
      },
      body: JSON.stringify({ tool, params }),
    })

    if (!res.ok) {
      const error = await res.text()
      logger.error({ tool, error }, 'MCP call failed')
      throw new Error(`MCP tool ${tool} failed: ${error}`)
    }

    return res.json()
  }
}

export const mcpClient = new MCPClient()
