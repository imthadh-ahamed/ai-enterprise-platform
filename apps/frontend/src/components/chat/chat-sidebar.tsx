'use client'

import { MessageSquare, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ChatSidebarProps {
  onNewChat: () => void
  className?: string
}

export function ChatSidebar({ onNewChat, className }: ChatSidebarProps) {
  return (
    <div className={cn('flex w-64 flex-col border-r bg-muted/20 p-3', className)}>
      <Button onClick={onNewChat} className="mb-4 w-full justify-start gap-2" variant="outline">
        <Plus className="h-4 w-4" />
        New Chat
      </Button>

      <div className="flex-1 space-y-1 overflow-y-auto">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">Recent</p>
        {[
          'Company Q4 revenue analysis',
          'Create Jira ticket for bug',
          'Summarize architecture docs',
        ].map((title, i) => (
          <div
            key={i}
            className="group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent"
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{title}</span>
            <Button
              variant="ghost"
              size="icon"
              className="invisible h-6 w-6 group-hover:visible"
              onClick={(e) => e.stopPropagation()}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="border-t pt-3">
        <p className="px-2 text-xs text-muted-foreground">Sprint 1 Demo</p>
      </div>
    </div>
  )
}
