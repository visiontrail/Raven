/**
 * Raven LLM Bridge — protocol types and error codes.
 *
 * The bridge exposes Raven-configured LLM providers to trusted webview consumers
 * (initially: embedded Chaterm) via the `raven:llm:*` IPC namespace. This module
 * defines the wire shapes; the runtime lives in `../RavenLLMBridgeService.ts`.
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

export const BRIDGE_ERROR_CODES = {
  BRIDGE_FORBIDDEN: 'E_BRIDGE_FORBIDDEN',
  MODEL_NOT_AVAILABLE: 'E_MODEL_NOT_AVAILABLE',
  NO_DEFAULT_MODEL: 'E_NO_DEFAULT_MODEL',
  BRIDGE_NOT_READY: 'E_BRIDGE_NOT_READY',
  INVALID_REQUEST: 'E_BRIDGE_INVALID_REQUEST'
} as const

export type BridgeErrorCode = (typeof BRIDGE_ERROR_CODES)[keyof typeof BRIDGE_ERROR_CODES]

export class BridgeError extends Error {
  constructor(
    public readonly code: BridgeErrorCode,
    message?: string
  ) {
    super(message ?? code)
    this.name = 'BridgeError'
  }
}

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
  /**
   * Fields the bridge MUST ignore even if a caller sets them. The bridge always
   * uses Raven-configured credentials.
   */
  apiKey?: never
  baseURL?: never
}

export interface CreateMessageAck {
  requestId: string
}

/**
 * Stream channel name for a given request. Dynamic — not enumerated in IpcChannel.
 */
export const streamChannelFor = (requestId: string): string => `raven:llm:stream:${requestId}`

/**
 * Internal channels used between the main process bridge and Raven's main renderer
 * (where AiProvider lives). Not exposed to webviews.
 */
export const INTERNAL_CHANNELS = {
  ListModels: 'raven:llm:internal:list-models',
  Execute: 'raven:llm:internal:execute',
  Event: 'raven:llm:internal:event',
  Abort: 'raven:llm:internal:abort'
} as const

/**
 * Pluggable provider interface used by the bridge to fan out a request.
 * Production wires this to a renderer-IPC implementation; tests can supply a fake.
 */
export interface BridgeProvider {
  listAvailableModels(): Promise<AvailableModel[]>
  getDefaultModelId(): Promise<string | null>
  createMessage(
    request: CreateMessageRequest,
    signal: AbortSignal,
    onEvent: (event: BridgeStreamEvent) => void
  ): Promise<void>
}
