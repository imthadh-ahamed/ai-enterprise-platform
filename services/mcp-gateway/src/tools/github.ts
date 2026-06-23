import { z } from 'zod'
import { Octokit } from '@octokit/rest'
import type { MCPTool } from '../registry/tool-registry'

const ReadRepoSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  path: z.string().optional().default(''),
  ref: z.string().optional().describe('Branch, tag, or commit SHA'),
})

const CreateIssueSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  title: z.string(),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
})

const SearchCodeSchema = z.object({
  query: z.string().describe('GitHub code search query'),
  owner: z.string().optional(),
  repo: z.string().optional(),
})

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

export const githubTools: MCPTool[] = [
  {
    name: 'read_github_repo',
    description: 'Read files and directory structure from a GitHub repository',
    inputSchema: ReadRepoSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof ReadRepoSchema>
      const { data } = await octokit.repos.getContent({ owner: p.owner, repo: p.repo, path: p.path, ref: p.ref })
      return data
    },
  },
  {
    name: 'create_github_issue',
    description: 'Create a GitHub issue in a repository',
    inputSchema: CreateIssueSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof CreateIssueSchema>
      const { data } = await octokit.issues.create({
        owner: p.owner, repo: p.repo, title: p.title, body: p.body, labels: p.labels, assignees: p.assignees,
      })
      return { issueNumber: data.number, url: data.html_url, title: data.title }
    },
  },
  {
    name: 'search_github_code',
    description: 'Search code across GitHub repositories',
    inputSchema: SearchCodeSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof SearchCodeSchema>
      const q = p.owner && p.repo ? `${p.query} repo:${p.owner}/${p.repo}` : p.query
      const { data } = await octokit.search.code({ q, per_page: 10 })
      return data.items.map(item => ({ path: item.path, repo: item.repository.full_name, url: item.html_url }))
    },
  },
]
