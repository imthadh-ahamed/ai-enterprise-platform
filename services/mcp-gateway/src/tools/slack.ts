import { z } from 'zod'
import { WebClient } from '@slack/web-api'
import type { MCPTool } from '../registry/tool-registry'

const SendMessageSchema = z.object({
  channel: z.string().describe('Channel ID or name (#general)'),
  message: z.string().max(3000),
  threadTs: z.string().optional().describe('Thread timestamp to reply to a thread'),
  blocks: z.array(z.unknown()).optional().describe('Slack Block Kit blocks for rich formatting'),
})

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)

export const slackTools: MCPTool[] = [
  {
    name: 'send_slack_message',
    description: 'Send a message to a Slack channel or thread',
    inputSchema: SendMessageSchema,
    handler: async (params) => {
      const p = params as z.infer<typeof SendMessageSchema>
      const result = await slack.chat.postMessage({
        channel: p.channel,
        text: p.message,
        thread_ts: p.threadTs,
        blocks: p.blocks as unknown[],
      })
      return { ok: result.ok, ts: result.ts, channel: result.channel }
    },
  },
  {
    name: 'list_slack_channels',
    description: 'List available Slack channels the bot has access to',
    inputSchema: z.object({ limit: z.number().int().min(1).max(200).default(50) }),
    handler: async (params) => {
      const p = params as { limit: number }
      const result = await slack.conversations.list({ limit: p.limit, exclude_archived: true })
      return result.channels?.map(c => ({ id: c.id, name: c.name, topic: c.topic?.value }))
    },
  },
]
