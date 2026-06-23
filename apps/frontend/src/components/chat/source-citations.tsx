'use client'

import { FileText, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface SourceCitationsProps {
  messages: Message[]
  className?: string
}

interface Citation {
  title: string
  snippet: string
  score: number
}

function parseCitations(messages: Message[]): Citation[] {
  const assistantMessages = messages.filter((m) => m.role === 'assistant')
  if (!assistantMessages.length) return []

  const last = assistantMessages[assistantMessages.length - 1]
  const matches = [...last.content.matchAll(/\[Source \d+\]: ([^\n]+)/g)]

  return matches.map((m, i) => ({
    title: `Source ${i + 1}`,
    snippet: m[1].substring(0, 120) + '…',
    score: 1 - i * 0.1,
  }))
}

export function SourceCitations({ messages, className }: SourceCitationsProps) {
  const citations = parseCitations(messages)

  return (
    <div className={cn('flex flex-col bg-muted/10 p-4', className)}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <FileText className="h-4 w-4" />
        Source Documents
      </h3>

      {citations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sources will appear here after the assistant responds with document context.
        </p>
      ) : (
        <div className="space-y-3">
          {citations.map((c, i) => (
            <div key={i} className="rounded-md border bg-background p-3 text-xs">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-medium">{c.title}</span>
                <span className="text-muted-foreground">{Math.round(c.score * 100)}%</span>
              </div>
              <p className="text-muted-foreground line-clamp-3">{c.snippet}</p>
              <button className="mt-2 flex items-center gap-1 text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />
                View document
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
