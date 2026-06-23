'use client'

import { useState, useRef, useCallback, ChangeEvent, FormEvent } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export function useStreamingChat({ api }: { api: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleInputChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      const text = input.trim()
      if (!text || isLoading) return

      const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
      const assistantId = crypto.randomUUID()
      const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '' }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setIsLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, messages: [...messages, userMsg] }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') break
              try {
                const parsed = JSON.parse(data)
                const delta = parsed.delta ?? parsed.content ?? ''
                if (delta) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + delta } : m
                    )
                  )
                }
              } catch {
                // plain text delta
                if (data) {
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId ? { ...m, content: m.content + data } : m
                    )
                  )
                }
              }
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
                : m
            )
          )
        }
      } finally {
        setIsLoading(false)
        abortRef.current = null
      }
    },
    [api, input, isLoading, messages]
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  return { messages, setMessages, input, handleInputChange, handleSubmit, isLoading, stop }
}
