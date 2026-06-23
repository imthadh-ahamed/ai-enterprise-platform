'use client'

import type { Message } from '@/hooks/use-streaming-chat'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Bot, User, Copy, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={cn('group flex gap-3', isUser && 'flex-row-reverse')}
      role="article"
      aria-label={`${isUser ? 'Your' : 'Assistant'} message`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn('flex flex-col gap-1 max-w-[75%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted rounded-tl-sm',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              className="prose prose-sm dark:prose-invert max-w-none"
              components={{
                code: ({ children, className }) => (
                  <code
                    className={cn(
                      'rounded bg-background/50 px-1 py-0.5 font-mono text-xs',
                      className,
                    )}
                  >
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-lg bg-background/50 p-3 text-xs">
                    {children}
                  </pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>

        {/* Actions */}
        {!isUser && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyToClipboard}>
              <Copy className="h-3 w-3" />
              <span className="sr-only">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ThumbsUp className="h-3 w-3" />
              <span className="sr-only">Good response</span>
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ThumbsDown className="h-3 w-3" />
              <span className="sr-only">Bad response</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
