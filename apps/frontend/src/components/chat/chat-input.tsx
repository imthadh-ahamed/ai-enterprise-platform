'use client'

import type { FormEvent, ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, Square, Paperclip, Mic } from 'lucide-react'
import { useRef, useCallback } from 'react'

interface ChatInputProps {
  input: string
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onSubmit: (e: FormEvent) => void
  onStop: () => void
  isLoading: boolean
}

export function ChatInput({ input, onChange, onSubmit, onStop, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!isLoading && input.trim()) {
          onSubmit(e as unknown as FormEvent)
        }
      }
    },
    [isLoading, input, onSubmit],
  )

  return (
    <div className="border-t bg-background px-4 py-4">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex flex-1 items-end gap-2 rounded-xl border bg-muted/30 px-3 py-2">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Paperclip className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>

          <Textarea
            ref={textareaRef}
            value={input}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything — query documents, databases, create tickets..."
            className="min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-sm"
            rows={1}
            aria-label="Chat input"
          />

          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Mic className="h-4 w-4" />
            <span className="sr-only">Voice input</span>
          </Button>
        </div>

        {isLoading ? (
          <Button type="button" variant="destructive" size="icon" onClick={onStop} className="h-10 w-10">
            <Square className="h-4 w-4" />
            <span className="sr-only">Stop generating</span>
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            className="h-10 w-10"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </form>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        AI can make mistakes. Verify important information.
      </p>
    </div>
  )
}
