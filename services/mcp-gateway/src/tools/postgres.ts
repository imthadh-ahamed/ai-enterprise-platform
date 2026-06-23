import { z } from 'zod'
import { Pool } from 'pg'
import type { MCPTool } from '../registry/tool-registry'

const QuerySchema = z.object({
  sql: z.string().refine(
    (s) => /^\s*SELECT\s/i.test(s),
    { message: 'Only SELECT queries are permitted through MCP' },
  ),
  params: z.array(z.unknown()).optional().default([]),
})

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export const postgresTools: MCPTool[] = [
  {
    name: 'query_database',
    description: 'Execute a read-only SQL SELECT query against the enterprise database',
    inputSchema: QuerySchema,
    handler: async (params) => {
      const p = params as z.infer<typeof QuerySchema>
      const result = await pool.query(p.sql, p.params as unknown[])
      return { data: result.rows, rowCount: result.rowCount, fields: result.fields.map(f => f.name) }
    },
  },
  {
    name: 'get_table_schema',
    description: 'Get the schema definition for a database table',
    inputSchema: z.object({ tableName: z.string().regex(/^[a-z_]+$/) }),
    handler: async (params) => {
      const p = params as { tableName: string }
      const result = await pool.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [p.tableName],
      )
      return result.rows
    },
  },
]
