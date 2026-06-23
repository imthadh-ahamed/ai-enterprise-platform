import { ChatAnthropic } from '@langchain/anthropic'
import { z } from 'zod'
import type { AgentStateType } from '../orchestrator'
import { mcpClient } from '../../lib/mcp-client'

const WorkflowActionSchema = z.object({
  tool: z.enum(['create_jira_ticket', 'send_slack_message', 'read_github_repo', 'list_s3_files', 'upload_document']),
  parameters: z.record(z.unknown()),
  explanation: z.string(),
})

const llm = new ChatAnthropic({
  model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  temperature: 0,
}).withStructuredOutput(WorkflowActionSchema)

export async function workflowAgent(state: AgentStateType) {
  // Determine which MCP tool to call
  const action = await llm.invoke([
    {
      role: 'system',
      content: `You are a workflow automation agent with access to external tools via MCP.
Available tools:
- create_jira_ticket(project, summary, description, priority, labels)
- send_slack_message(channel, message, thread_ts?)
- read_github_repo(owner, repo, path?)
- list_s3_files(bucket, prefix?)
- upload_document(name, content, contentType)

Choose the right tool and extract all parameters from the user request.`,
    },
    { role: 'user', content: state.userQuery },
  ])

  // Execute the MCP tool
  const result = await mcpClient.call(action.tool, {
    ...action.parameters,
    tenantId: state.tenantId,
    userId: state.userId,
  })

  return {
    finalAnswer: `✅ ${action.explanation}\n\nResult: ${JSON.stringify(result, null, 2)}`,
    agentPath: ['workflow_agent'],
    context: { mcpTool: action.tool, mcpResult: result },
  }
}
