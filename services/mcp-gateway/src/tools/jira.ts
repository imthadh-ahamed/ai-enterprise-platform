import { z } from 'zod'
import type { MCPTool } from '../registry/tool-registry'

const CreateTicketSchema = z.object({
  project: z.string().describe('Jira project key, e.g. PROJ'),
  summary: z.string().max(255),
  description: z.string().optional(),
  issueType: z.enum(['Bug', 'Story', 'Task', 'Epic']).default('Task'),
  priority: z.enum(['Highest', 'High', 'Medium', 'Low', 'Lowest']).default('Medium'),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional().describe('Jira account ID'),
})

const GetIssueSchema = z.object({
  issueKey: z.string().describe('Jira issue key, e.g. PROJ-123'),
})

const SearchIssuesSchema = z.object({
  jql: z.string().describe('Jira Query Language expression'),
  maxResults: z.number().int().min(1).max(100).default(20),
})

function getJiraClient() {
  const { Version3Client } = require('jira.js')
  return new Version3Client({
    host: process.env.JIRA_BASE_URL!,
    authentication: {
      basic: { email: process.env.JIRA_EMAIL!, apiToken: process.env.JIRA_API_TOKEN! },
    },
  })
}

export const jiraTools: MCPTool[] = [
  {
    name: 'create_jira_ticket',
    description: 'Create a new Jira issue/ticket in a project',
    inputSchema: CreateTicketSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof CreateTicketSchema>
      const client = getJiraClient()
      const issue = await client.issues.createIssue({
        fields: {
          project: { key: p.project },
          summary: p.summary,
          description: p.description
            ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: p.description }] }] }
            : undefined,
          issuetype: { name: p.issueType },
          priority: { name: p.priority },
          labels: p.labels,
        },
      })
      return { issueKey: issue.key, issueId: issue.id, url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}` }
    },
  },
  {
    name: 'get_jira_issue',
    description: 'Get details of a specific Jira issue',
    inputSchema: GetIssueSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof GetIssueSchema>
      const client = getJiraClient()
      return client.issues.getIssue({ issueIdOrKey: p.issueKey })
    },
  },
  {
    name: 'search_jira_issues',
    description: 'Search Jira issues using JQL',
    inputSchema: SearchIssuesSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof SearchIssuesSchema>
      const client = getJiraClient()
      return client.issueSearch.searchForIssuesUsingJql({ jql: p.jql, maxResults: p.maxResults })
    },
  },
]
