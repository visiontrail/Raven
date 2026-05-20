/**
 * Shared protocol types for the Chaterm LLM bridge.
 *
 * Used by both the main process (RendererBridgeProvider) and the renderer
 * (ChatermBridgeService) so the wire contract stays in one place.
 */

export type FinishReason = 'stop' | 'length' | 'tool_use' | 'abort' | 'error'

export type BridgeStreamEvent =
  | { type: 'start'; modelId: string; createdAt: number }
  | { type: 'text'; delta: string }
  | { type: 'tool_use_start'; toolCallId: string; name: string; partialInput?: string }
  | { type: 'tool_use_delta'; toolCallId: string; inputJsonDelta: string }
  | { type: 'tool_use_end'; toolCallId: string; finalInput: unknown }
  | {
      type: 'usage'
      inputTokens: number
      outputTokens: number
      cacheRead?: number
      cacheWrite?: number
    }
  | { type: 'end'; finishReason: FinishReason; error?: string }

export interface ModelCapabilities {
  tools: boolean
  vision: boolean
  streaming: boolean
}

export interface AvailableModel {
  providerId: string
  modelId: string
  displayName: string
  capabilities: ModelCapabilities
}

export interface BridgeMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: unknown
}

export interface CreateMessageRequest {
  requestId: string
  systemPrompt?: string
  messages: BridgeMessage[]
  tools?: unknown[]
  modelId?: string
  apiKey?: never
  baseURL?: never
}

export interface CreateMessageAck {
  requestId: string
}

export const streamChannelFor = (requestId: string): string => `raven:llm:stream:${requestId}`

/**
 * Internal channels used between the main process bridge and Raven's main renderer.
 * Not exposed to webviews.
 */
export const INTERNAL_CHANNELS = {
  ListModels: 'raven:llm:internal:list-models',
  Execute: 'raven:llm:internal:execute',
  Event: 'raven:llm:internal:event',
  Abort: 'raven:llm:internal:abort'
} as const
