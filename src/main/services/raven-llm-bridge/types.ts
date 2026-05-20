/**
 * Raven LLM Bridge — protocol types and error codes.
 *
 * Wire-protocol types (BridgeStreamEvent, AvailableModel, CreateMessageRequest,
 * INTERNAL_CHANNELS, etc.) live in the shared package so the renderer-side
 * ChatermBridgeService can import them without crossing build-target boundaries.
 */

// Re-export shared wire types so existing imports within the main process
// continue to work without modification.
export type {
  AvailableModel,
  BridgeMessage,
  BridgeStreamEvent,
  CreateMessageAck,
  CreateMessageRequest,
  FinishReason,
  ModelCapabilities
} from '@shared/chaterm-bridge'
export { INTERNAL_CHANNELS, streamChannelFor } from '@shared/chaterm-bridge'

// ---------- Main-process-only types ----------

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

import type { AvailableModel, BridgeStreamEvent, CreateMessageRequest } from '@shared/chaterm-bridge'

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
