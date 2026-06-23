import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { AgentStateType } from '../orchestrator'
import { ragServiceClient } from '../../lib/rag-client'

const llm = new ChatAnthropic({
  model: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  temperature: 0.1,
  maxTokens: 4096,
})

export async function ragAgent(state: AgentStateType) {
  // 1. Retrieve relevant chunks from RAG service
  const retrievalResult = await ragServiceClient.retrieve({
    query: state.userQuery,
    tenantId: state.tenantId,
    topK: Number(process.env.RAG_TOP_K) || 10,
    rerankTopK: Number(process.env.RAG_RERANK_TOP_K) || 5,
  })

  const { chunks, citations } = retrievalResult

  if (chunks.length === 0) {
    return {
      finalAnswer: "I couldn't find relevant information in your knowledge base for this query.",
      agentPath: ['rag_agent'],
    }
  }

  // 2. Build context from retrieved chunks
  const context = chunks
    .map((c, i) => `[Source ${i + 1}] ${c.documentTitle} (page ${c.pageNumber}):\n${c.content}`)
    .join('\n\n---\n\n')

  // 3. Generate answer with citation awareness
  const response = await llm.invoke([
    new SystemMessage(`You are an enterprise knowledge assistant. Answer questions using ONLY the provided context.
Always cite your sources using [Source N] notation. If the context doesn't contain enough information, say so clearly.
Context:
${context}`),
    new HumanMessage(state.userQuery),
  ])

  const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content)

  return {
    finalAnswer: content,
    citations,
    agentPath: ['rag_agent'],
    tokenUsage: {
      input: response.usage_metadata?.input_tokens || 0,
      output: response.usage_metadata?.output_tokens || 0,
    },
  }
}
