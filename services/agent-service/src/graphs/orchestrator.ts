import { StateGraph, Annotation, END, START } from '@langchain/langgraph'
import { ChatAnthropic } from '@langchain/anthropic'
import { ChatOpenAI } from '@langchain/openai'
import { BaseMessage, HumanMessage, AIMessage } from '@langchain/core/messages'
import { routerAgent } from './nodes/router'
import { ragAgent } from './nodes/rag-agent'
import { sqlAgent } from './nodes/sql-agent'
import { workflowAgent } from './nodes/workflow-agent'
import { reportAgent } from './nodes/report-agent'
import { memoryManager } from './nodes/memory-manager'
import { humanInLoop } from './nodes/human-in-loop'
import { logger } from '../lib/logger'

// ── State schema ──────────────────────────────────────────────
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
  userQuery: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),
  userId: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),
  tenantId: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),
  intent: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),
  agentPath: Annotation<string[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
  context: Annotation<Record<string, unknown>>({
    reducer: (curr, update) => ({ ...curr, ...update }),
    default: () => ({}),
  }),
  requiresHumanApproval: Annotation<boolean>({ reducer: (_, x) => x, default: () => false }),
  finalAnswer: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),
  citations: Annotation<unknown[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),
  tokenUsage: Annotation<{ input: number; output: number }>({
    reducer: (curr, update) => ({
      input: curr.input + update.input,
      output: curr.output + update.output,
    }),
    default: () => ({ input: 0, output: 0 }),
  }),
  error: Annotation<string | null>({ reducer: (_, x) => x, default: () => null }),
})

type AgentStateType = typeof AgentState.State

// ── Routing logic ─────────────────────────────────────────────
function routeAfterRouter(state: AgentStateType): string {
  if (state.error) return 'error_handler'
  if (state.requiresHumanApproval) return 'human_in_loop'

  switch (state.intent) {
    case 'rag_query':
    case 'document_search':
      return 'rag_agent'
    case 'sql_query':
    case 'data_analysis':
      return 'sql_agent'
    case 'create_ticket':
    case 'send_message':
    case 'trigger_workflow':
      return 'workflow_agent'
    case 'generate_report':
      return 'report_agent'
    default:
      return 'rag_agent'
  }
}

function routeAfterHumanInLoop(state: AgentStateType): string {
  return state.requiresHumanApproval ? END : state.intent + '_agent'
}

// ── Build graph ───────────────────────────────────────────────
export function buildOrchestratorGraph() {
  const graph = new StateGraph(AgentState)
    .addNode('memory_manager', memoryManager)
    .addNode('router', routerAgent)
    .addNode('rag_agent', ragAgent)
    .addNode('sql_agent', sqlAgent)
    .addNode('workflow_agent', workflowAgent)
    .addNode('report_agent', reportAgent)
    .addNode('human_in_loop', humanInLoop)
    .addNode('error_handler', async (state) => {
      logger.error({ error: state.error }, 'Agent error')
      return { finalAnswer: `I encountered an error: ${state.error}. Please try again.` }
    })
    .addEdge(START, 'memory_manager')
    .addEdge('memory_manager', 'router')
    .addConditionalEdges('router', routeAfterRouter, {
      rag_agent: 'rag_agent',
      sql_agent: 'sql_agent',
      workflow_agent: 'workflow_agent',
      report_agent: 'report_agent',
      human_in_loop: 'human_in_loop',
      error_handler: 'error_handler',
    })
    .addConditionalEdges('human_in_loop', routeAfterHumanInLoop)
    .addEdge('rag_agent', END)
    .addEdge('sql_agent', END)
    .addEdge('workflow_agent', END)
    .addEdge('report_agent', END)
    .addEdge('error_handler', END)

  return graph.compile()
}

export type { AgentStateType }
