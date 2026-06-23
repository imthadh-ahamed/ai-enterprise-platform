import { ChatAnthropic } from '@langchain/anthropic'
import type { AgentStateType } from '../orchestrator'
import { ragServiceClient } from '../../lib/rag-client'
import { mcpClient } from '../../lib/mcp-client'

const llm = new ChatAnthropic({
  model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  temperature: 0.2,
  maxTokens: 8192,
})

export async function reportAgent(state: AgentStateType) {
  // Gather data from multiple sources in parallel
  const [ragData, dbData] = await Promise.allSettled([
    ragServiceClient.retrieve({ query: state.userQuery, tenantId: state.tenantId, topK: 20, rerankTopK: 10 }),
    mcpClient.call('query_database', {
      sql: `SELECT * FROM analytics_summary WHERE tenant_id = '${state.tenantId}' ORDER BY created_at DESC LIMIT 100`,
      tenantId: state.tenantId,
    }),
  ])

  const knowledgeContext = ragData.status === 'fulfilled' ? ragData.value.chunks.map(c => c.content).join('\n\n') : ''
  const analyticsData = dbData.status === 'fulfilled' ? dbData.value.data : []

  const report = await llm.invoke([
    {
      role: 'system',
      content: `You are a business intelligence analyst. Generate comprehensive, executive-ready reports.
Use markdown formatting with clear sections: Executive Summary, Key Findings, Data Analysis, Recommendations.
Include specific metrics and actionable insights.`,
    },
    {
      role: 'user',
      content: `Generate a report for: ${state.userQuery}

Knowledge Base Context:
${knowledgeContext}

Analytics Data:
${JSON.stringify(analyticsData, null, 2)}`,
    },
  ])

  const content = typeof report.content === 'string' ? report.content : JSON.stringify(report.content)

  return {
    finalAnswer: content,
    agentPath: ['report_agent'],
    tokenUsage: {
      input: report.usage_metadata?.input_tokens || 0,
      output: report.usage_metadata?.output_tokens || 0,
    },
  }
}
