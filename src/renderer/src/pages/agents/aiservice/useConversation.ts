import type { ChatSessionSummary, ConversationState } from '@renderer/types/aiServiceAgent'
import { useSyncExternalStore } from 'react'

import { conversationStore } from './conversationStore'

/** Re-render whenever the conversation store mutates. */
export function useStoreVersion(): number {
  return useSyncExternalStore(conversationStore.subscribe, conversationStore.getVersion, conversationStore.getVersion)
}

export function useConversation(sessionId: string | null): ConversationState | null {
  useStoreVersion()
  return sessionId ? conversationStore.ensureState(sessionId) : null
}

export function useSessions(): {
  sessions: ChatSessionSummary[]
  loading: boolean
  error: string | null
} {
  useStoreVersion()
  return {
    sessions: conversationStore.sessions,
    loading: conversationStore.sessionsLoading,
    error: conversationStore.sessionsError
  }
}
