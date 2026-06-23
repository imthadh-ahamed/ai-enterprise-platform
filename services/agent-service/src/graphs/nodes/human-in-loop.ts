import type { AgentStateType } from '../orchestrator'

// Human-in-the-loop node: persists state and waits for approval via webhook
export async function humanInLoop(state: AgentStateType) {
  // In production: persist state to DB, send notification, and surface approval UI
  // The graph is interrupted here and resumed via POST /api/v1/agent/approve/:threadId
  return {
    requiresHumanApproval: true,
    finalAnswer: `⚠️ This action requires human approval. A notification has been sent to your admin. The action will proceed once approved.`,
  }
}
