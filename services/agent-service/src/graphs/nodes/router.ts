import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { z } from 'zod'
import type { AgentStateType } from '../orchestrator'

const IntentSchema = z.object({
  intent: z.enum([
    'rag_query',
    'document_search',
    'sql_query',
    'data_analysis',
    'create_ticket',
    'send_message',
    'trigger_workflow',
    'generate_report',
    'general_chat',
  ]),
  confidence: z.number().min(0).max(1),
  requiresHumanApproval: z.boolean(),
  reasoning: z.string(),
  suggestedAgents: z.array(z.string()),
})

const llm = new ChatAnthropic({
  model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  temperature: 0,
}).withStructuredOutput(IntentSchema)

export async function routerAgent(state: AgentStateType) {
  const result = await llm.invoke([
    {
      role: 'system',
      content: `You are an intent classifier for an enterprise AI platform.
Classify the user's query into the most appropriate intent and determine routing.

Available intents:
- rag_query: Search company documents, knowledge base, or uploaded files
- document_search: Find specific documents or files
- sql_query: Query databases using natural language
- data_analysis: Analyze data, generate statistics, compare numbers
- create_ticket: Create Jira tickets, GitHub issues, or task items
- send_message: Send Slack messages, emails, or notifications
- trigger_workflow: Trigger external workflows, automation, or integrations
- generate_report: Generate comprehensive business reports
- general_chat: General conversation not requiring specialized tools

requiresHumanApproval = true only for destructive actions (delete, modify production data).`,
    },
    { role: 'user', content: state.userQuery },
  ])

  return {
    intent: result.intent,
    requiresHumanApproval: result.requiresHumanApproval,
    agentPath: ['router'],
    context: { routerReasoning: result.reasoning, confidence: result.confidence },
  }
}
