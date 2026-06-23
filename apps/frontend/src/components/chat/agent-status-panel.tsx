'use client'

import { Bot } from 'lucide-react'

export function AgentStatusPanel() {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      <Bot className="h-4 w-4 animate-pulse" />
      <span>Agent is thinking</span>
      <span className="flex gap-0.5">
        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
      </span>
    </div>
  )
}
