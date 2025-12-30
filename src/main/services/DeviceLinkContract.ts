/**
 * Device link WebSocket contract shared with RavenAIService.
 *
 * Endpoint: ws://<raven_ai_service_host>:8085/ws/device-link
 * Frames are JSON text with a "type" discriminator.
 *
 * Message types:
 * - register (client -> server)
 *   { type, device_id, device_name, client_version, host, models: [name], capabilities?: {...} }
 * - register_ack (server -> client)
 *   { type: 'register_ack', device_id, heartbeat_interval, server_time }
 * - ping / pong (bidirectional): { type: 'ping'|'pong' }
 * - prompt (server -> client)
 *   { type: 'prompt', request_id, session_id, prompt, system_prompt?, target_device_id, metadata? }
 * - prompt_ack (client -> server, optional)
 *   { type: 'prompt_ack', request_id, session_id, topic_id? }
 * - prompt_result (client -> server)
 *   { type: 'prompt_result', request_id, session_id, topic_id, answer, raw_messages? }
 * - error (bidirectional): { type: 'error', request_id?, message }
 *
 * Server keeps: device_id -> connection with status/last_seen/metadata, and a pending map request_id -> future.
 * Client keeps: session_id -> topic_id so prompts within one AIChat session reuse the same Topic.
 */

export const DEVICE_LINK_WS_PATH = '/ws/device-link'

export interface RegisterMessage {
  type: 'register'
  device_id: string
  device_name: string
  client_version: string
  host: string
  models: string[]
  capabilities?: DeviceCapabilities
}

export interface RegisterAckMessage {
  type: 'register_ack'
  device_id: string
  heartbeat_interval: number
  server_time: number
}

export interface PingMessage {
  type: 'ping'
}

export interface PongMessage {
  type: 'pong'
}

export interface PromptMessage {
  type: 'prompt'
  request_id: string
  session_id: string
  prompt: string
  system_prompt?: string
  target_device_id: string
  metadata?: Record<string, unknown>
}

export interface PromptAckMessage {
  type: 'prompt_ack'
  request_id: string
  session_id: string
  topic_id?: string
}

export interface PromptResultMessage {
  type: 'prompt_result'
  request_id: string
  session_id: string
  topic_id: string
  answer: string
  raw_messages?: unknown[]
}

export interface ErrorMessage {
  type: 'error'
  request_id?: string
  message: string
}

export interface CapabilitiesUpdateMessage {
  type: 'capabilities_update'
  device_id?: string
  capabilities: DeviceCapabilities
}

export interface McpToolParameter {
  name: string
  description?: string
  required?: boolean
  schema?: Record<string, unknown>
}

export interface McpToolCapability {
  name: string
  description?: string
  input_schema?: Record<string, unknown>
  output_schema?: Record<string, unknown>
  parameters?: McpToolParameter[]
}

export interface McpPromptCapability {
  name: string
  description?: string
  arguments?: unknown
}

export interface McpResourceCapability {
  uri: string
  name?: string
  description?: string
  mimeType?: string
}

export interface McpServerCapability {
  id: string
  name: string
  provider?: string
  type?: string
  baseUrl?: string
  description?: string
  tools?: McpToolCapability[]
  prompts?: McpPromptCapability[]
  resources?: McpResourceCapability[]
}

export interface DeviceCapabilities {
  mcp?: {
    servers: McpServerCapability[]
    collectedAt?: string
  }
  [key: string]: unknown
}

export type ClientToServerMessage =
  | RegisterMessage
  | PingMessage
  | PongMessage
  | PromptAckMessage
  | PromptResultMessage
  | CapabilitiesUpdateMessage
  | ErrorMessage

export type ServerToClientMessage = RegisterAckMessage | PingMessage | PongMessage | PromptMessage | ErrorMessage
