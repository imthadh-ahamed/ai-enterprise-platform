import { ChatAnthropic } from '@langchain/anthropic'
import { z } from 'zod'
import type { AgentStateType } from '../orchestrator'
import { mcpClient } from '../../lib/mcp-client'

const SQLQuerySchema = z.object({
  sql: z.string().describe('The SQL query to execute — SELECT only for safety'),
  explanation: z.string().describe('Plain-English explanation of what the query does'),
  tables: z.array(z.string()).describe('Database tables referenced'),
  isSafe: z.boolean().describe('True if the query is read-only (SELECT)'),
})

const llm = new ChatAnthropic({
  model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  temperature: 0,
}).withStructuredOutput(SQLQuerySchema)

export async function sqlAgent(state: AgentStateType) {
  // 1. Generate SQL from natural language
  const queryPlan = await llm.invoke([
    {
      role: 'system',
      content: `You are an expert SQL generator. Convert natural language to safe, efficient SQL.
Only generate SELECT queries — never INSERT, UPDATE, DELETE, or DDL.
Database schema context: ${JSON.stringify(state.context.dbSchema || {})}`,
    },
    { role: 'user', content: state.userQuery },
  ])

  if (!queryPlan.isSafe) {
    return {
      finalAnswer: 'I can only execute read-only queries. Destructive operations require manual execution.',
      agentPath: ['sql_agent'],
    }
  }

  // 2. Execute via MCP PostgreSQL server
  const result = await mcpClient.call('query_database', {
    sql: queryPlan.sql,
    tenantId: state.tenantId,
  })

  // 3. Format result for human consumption
  const formatterLLM = new ChatAnthropic({
    model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
    temperature: 0.1,
  })

  const formatted = await formatterLLM.invoke([
    {
      role: 'system',
      content: 'Format database query results in a clear, readable way. Use markdown tables when appropriate.',
    },
    {
      role: 'user',
      content: `Query: ${state.userQuery}\nSQL executed: ${queryPlan.sql}\nResults: ${JSON.stringify(result.data)}`,
    },
  ])

  const content = typeof formatted.content === 'string' ? formatted.content : JSON.stringify(formatted.content)

  return {
    finalAnswer: content,
    agentPath: ['sql_agent'],
    context: { sqlQuery: queryPlan.sql, rowCount: result.rowCount },
  }
}
