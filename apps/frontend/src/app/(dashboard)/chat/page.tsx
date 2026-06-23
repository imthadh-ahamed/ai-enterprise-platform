'use client'

import { useState, useRef, useEffect } from 'react'
import { ChatMessage } from '@/components/chat/chat-message'
import { ChatInput } from '@/components/chat/chat-input'
import { ChatSidebar } from '@/components/chat/chat-sidebar'
import { AgentStatusPanel } from '@/components/chat/agent-status-panel'
import { SourceCitations } from '@/components/chat/source-citations'
import { Button } from '@/components/ui/button'
import { PanelRightOpen, PanelRightClose } from 'lucide-react'
import { useStreamingChat } from '@/hooks/use-streaming-chat'

export default function ChatPage() {
  const [showSources, setShowSources] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading, stop } =
    useStreamingChat({ api: '/api/chat' })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar onNewChat={() => setMessages([])} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b px-6 py-3">
          <div>
            <h1 className="text-lg font-semibold">AI Knowledge Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by multi-agent RAG + MCP</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSources(!showSources)}
            title="Toggle source panel"
          >
            {showSources ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h2 className="text-xl font-semibold mb-2">How can I help you today?</h2>
              <p className="text-muted-foreground max-w-md">
                Ask me anything about your company documents, databases, or trigger business
                workflows using natural language.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AgentStatusPanel />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          input={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          onStop={stop}
          isLoading={isLoading}
        />
      </div>

      {showSources && <SourceCitations messages={messages} className="w-80 border-l" />}
    </div>
  )
}
