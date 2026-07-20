/**
 * Renderer-side handler for the Chaterm LLM bridge.
 *
 * The main process's RendererBridgeProvider sends three internal IPC channels
 * to this window:
 *   - INTERNAL_CHANNELS.ListModels → return filtered AvailableModel[]
 *   - INTERNAL_CHANNELS.Execute    → stream BridgeStreamEvents back
 *   - INTERNAL_CHANNELS.Abort      → cancel an in-flight request
 *
 * See: src/main/services/raven-llm-bridge/types.ts for the protocol types.
 * See: src/main/services/raven-llm-bridge/RendererBridgeProvider.ts for how
 *      the main process drives these channels.
 */

import Anthropic from '@anthropic-ai/sdk'
import { loggerService } from '@logger'
import { isEmbeddingModel, isFunctionCallingModel, isRerankModel, isVisionModel } from '@renderer/config/models'
import { getDefaultModel, getProviderByModelId } from '@renderer/services/AssistantService'
import store from '@renderer/store'
import {
  AvailableModel,
  BridgeStreamEvent,
  CreateMessageRequest,
  FinishReason,
  INTERNAL_CHANNELS
} from '@shared/chaterm-bridge'
import OpenAI from 'openai'

const logger = loggerService.withContext('ChatermBridgeService')

/** Provider types with full tool-calling support in v1. */
const V1_FULL_TOOL_TYPES = new Set(['anthropic', 'openai', 'openai-response', 'azure-openai', 'mistral'])

/** Provider types kept in list but capabilities.tools=false for v1 gray. */
const V1_GRAY_TYPES = new Set(['gemini', 'vertexai', 'qwenlm', 'aws-bedrock'])

interface InFlightRequest {
  abortController: AbortController
  finishAbort: () => void
}

interface ToolAccumulator {
  id: string
  name: string
  inputJson: string
  ended: boolean
}

const parseToolInput = (inputJson: string): unknown => {
  const trimmed = inputJson.trim()
  if (!trimmed) return {}
  try {
    return JSON.parse(trimmed)
  } catch {
    return inputJson
  }
}

/** Start of a JSON-encoded "content parts" array (e.g. `[{"type":"text",...`). */
const CONTENT_PARTS_START = /^\s*\[\s*\{\s*"type"\s*:\s*"(?:text|reasoning|thinking)"/
/** Characters to buffer before classifying a `[`-leading text stream. */
const CONTENT_PARTS_CLASSIFY_MIN = 32

/** Text of a single content part: the part itself when a string, else its `text` field. */
const partText = (part: unknown): string => {
  if (typeof part === 'string') return part
  if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') {
    return (part as { text: string }).text
  }
  return ''
}

/**
 * Coerce a raw `delta.content` value into plain text. Handles plain strings and
 * structured content-part arrays (`[{ type: 'text', text: '...' }]`).
 */
const coerceContentToText = (content: unknown): string => {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map(partText).join('')
  return ''
}

/**
 * Extract concatenated text from a JSON-encoded content-parts array string.
 * Returns null when the string is not a parseable content-parts array.
 */
const extractContentPartsText = (raw: string): string | null => {
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    return parsed.map(partText).join('')
  } catch {
    return null
  }
}

/**
 * Normalizes streamed assistant text into plain-text deltas.
 *
 * Most providers stream `delta.content` as plain text, forwarded as-is. Some
 * OpenAI-compatible gateways (observed with certain DeepSeek deployments) instead
 * return the whole message as a JSON-encoded content-parts array, e.g.
 *   [{"type":"text","text":"...\n| a | b |\n..."}]
 * Forwarding that verbatim breaks downstream Markdown rendering — tables, headings
 * and newlines arrive as literal JSON text. When the stream begins with that shape
 * we buffer it and emit the unwrapped text once the full array has arrived; plain
 * text is still streamed incrementally.
 */
class StreamTextNormalizer {
  private decided = false
  private wrapped = false
  private buffer = ''

  constructor(private readonly emit: (delta: string) => void) {}

  push(content: unknown): void {
    const piece = coerceContentToText(content)
    if (!piece) return

    if (this.decided) {
      if (this.wrapped) this.buffer += piece
      else this.emit(piece)
      return
    }

    this.buffer += piece
    const trimmed = this.buffer.replace(/^\s+/, '')
    if (trimmed.length === 0) return
    // A content-parts array always begins with '['. Anything else is plain text.
    if (trimmed[0] !== '[') {
      this.flushPlain()
      return
    }
    // Leading '[': wait until we have enough characters to classify reliably.
    if (trimmed.length < CONTENT_PARTS_CLASSIFY_MIN) return
    this.classify()
  }

  /** Flush any buffered text once the stream has ended. */
  end(): void {
    if (!this.decided) this.classify()
    if (this.wrapped && this.buffer) {
      this.emit(extractContentPartsText(this.buffer) ?? this.buffer)
      this.buffer = ''
    }
  }

  private classify(): void {
    this.decided = true
    if (CONTENT_PARTS_START.test(this.buffer)) {
      this.wrapped = true
      return
    }
    this.flushPlain()
  }

  private flushPlain(): void {
    this.decided = true
    if (this.buffer) {
      this.emit(this.buffer)
      this.buffer = ''
    }
  }
}

class ChatermBridgeService {
  private readonly inFlight = new Map<string, InFlightRequest>()
  private started = false
  private readonly listeners: Array<() => void> = []

  start(): void {
    if (this.started) return
    this.started = true

    const ipc = window.electron.ipcRenderer

    const removeListModels = ipc.on(INTERNAL_CHANNELS.ListModels, (_event, payload: { replyChannel: string; defaultOnly?: boolean }) => {
      try {
        if (payload.defaultOnly) {
          ipc.send(payload.replyChannel, { modelId: getDefaultModel()?.id ?? null })
          return
        }
        const models = this.buildAvailableModels()
        ipc.send(payload.replyChannel, models)
      } catch (err) {
        logger.error('ChatermBridgeService: listModels failed', err as Error)
        ipc.send(payload.replyChannel, payload.defaultOnly ? { modelId: null } : [])
      }
    })

    const removeExecute = ipc.on(INTERNAL_CHANNELS.Execute, (_event, req: CreateMessageRequest) => {
      void this.handleExecute(req)
    })

    const removeAbort = ipc.on(INTERNAL_CHANNELS.Abort, (_event, payload: { requestId: string }) => {
      this.handleAbort(payload.requestId)
    })

    // electron-toolkit returns a cleanup function from ipc.on
    if (typeof removeListModels === 'function') this.listeners.push(removeListModels)
    if (typeof removeExecute === 'function') this.listeners.push(removeExecute)
    if (typeof removeAbort === 'function') this.listeners.push(removeAbort)

    logger.info('ChatermBridgeService started')
  }

  stop(): void {
    for (const fn of this.listeners) fn()
    this.listeners.length = 0
    for (const req of this.inFlight.values()) req.abortController.abort()
    this.inFlight.clear()
    this.started = false
    logger.info('ChatermBridgeService stopped')
  }

  // ---------- model listing ----------

  private buildAvailableModels(): AvailableModel[] {
    const providers = store.getState().llm.providers
    const models: AvailableModel[] = []

    for (const provider of providers) {
      if (!provider.enabled) continue
      const apiKey = (provider.apiKey ?? '').split(',')[0].trim()
      if (!apiKey) continue

      const isFullTool = V1_FULL_TOOL_TYPES.has(provider.type)
      const isGray = V1_GRAY_TYPES.has(provider.type)

      for (const model of provider.models ?? []) {
        // Skip embedding / reranking models
        if (isEmbeddingModel(model) || isRerankModel(model)) continue

        models.push({
          providerId: provider.id,
          modelId: model.id,
          displayName: model.name,
          capabilities: {
            tools: isFullTool ? isFunctionCallingModel(model) : isGray ? false : false,
            vision: isVisionModel(model),
            streaming: true
          }
        })
      }
    }

    return models
  }

  // ---------- execute ----------

  private async handleExecute(req: CreateMessageRequest): Promise<void> {
    const ipc = window.electron.ipcRenderer
    const send = (event: BridgeStreamEvent) => {
      ipc.send(INTERNAL_CHANNELS.Event, { requestId: req.requestId, event })
    }
    let ended = false
    const dispatch = (event: BridgeStreamEvent) => {
      if (ended) return
      if (event.type === 'end') ended = true
      send(event)
    }

    const modelId = req.modelId ?? getDefaultModel().id
    const provider = getProviderByModelId(modelId)

    logger.info('ChatermBridgeService: execute started', {
      requestId: req.requestId,
      modelId,
      messageCount: req.messages?.length ?? 0
    })

    if (!provider) {
      dispatch({ type: 'end', finishReason: 'error', error: 'provider not found for model' })
      return
    }

    const abortController = new AbortController()
    this.inFlight.set(req.requestId, {
      abortController,
      finishAbort: () => dispatch({ type: 'end', finishReason: 'abort' })
    })

    try {
      const finishReason = await this.streamCompletion(req, modelId, provider, abortController.signal, dispatch)
      dispatch({
        type: 'end',
        finishReason: abortController.signal.aborted ? 'abort' : finishReason
      })
      logger.info('ChatermBridgeService: execute finished', {
        requestId: req.requestId,
        modelId,
        finishReason: abortController.signal.aborted ? 'abort' : finishReason
      })
    } catch (err) {
      if (!abortController.signal.aborted) {
        dispatch({ type: 'end', finishReason: 'error', error: (err as Error).message })
        logger.error('ChatermBridgeService: execute failed', err as Error, { requestId: req.requestId, modelId })
      } else {
        dispatch({ type: 'end', finishReason: 'abort' })
        logger.info('ChatermBridgeService: execute aborted', { requestId: req.requestId, modelId })
      }
    } finally {
      this.inFlight.delete(req.requestId)
    }
  }

  private async streamCompletion(
    req: CreateMessageRequest,
    modelId: string,
    provider: ReturnType<typeof getProviderByModelId>,
    signal: AbortSignal,
    dispatch: (event: BridgeStreamEvent) => void
  ): Promise<FinishReason> {
    const apiKey = (provider.apiKey ?? '').split(',')[0].trim()
    const pType = provider.type
    logger.info('ChatermBridgeService: streamCompletion provider selected', {
      requestId: req.requestId,
      modelId,
      providerType: pType,
      hasApiHost: Boolean(provider.apiHost)
    })

    if (pType === 'anthropic') {
      return this.streamAnthropic(req, modelId, apiKey, provider.apiHost, signal, dispatch)
    } else if (['openai', 'openai-response', 'azure-openai', 'mistral', 'qwenlm'].includes(pType)) {
      return this.streamOpenAI(req, modelId, apiKey, provider.apiHost, signal, dispatch)
    } else {
      throw new Error(`provider type "${pType}" is not supported in v1 bridge`)
    }
  }

  private async streamAnthropic(
    req: CreateMessageRequest,
    modelId: string,
    apiKey: string,
    baseURL: string,
    signal: AbortSignal,
    dispatch: (event: BridgeStreamEvent) => void
  ): Promise<FinishReason> {
    const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true })
    const toolsByIndex = new Map<number, ToolAccumulator>()
    let finishReason: FinishReason = 'stop'

    const messages = (req.messages ?? [])
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))

    if (messages.length === 0) {
      messages.push({ role: 'user', content: req.systemPrompt ?? '' })
    }

    const stream = client.messages.stream({
      model: modelId,
      max_tokens: 8192,
      system: req.systemPrompt,
      messages
    })

    for await (const event of stream) {
      if (signal.aborted) break

      if (event.type === 'content_block_start' && (event as any).content_block?.type === 'tool_use') {
        const index = (event as any).index ?? toolsByIndex.size
        const block = (event as any).content_block
        const tool: ToolAccumulator = {
          id: block.id,
          name: block.name,
          inputJson: block.input ? JSON.stringify(block.input) : '',
          ended: false
        }
        toolsByIndex.set(index, tool)
        dispatch({
          type: 'tool_use_start',
          toolCallId: tool.id,
          name: tool.name,
          partialInput: tool.inputJson || undefined
        })
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        dispatch({ type: 'text', delta: event.delta.text })
      } else if (event.type === 'content_block_delta' && (event.delta as any).type === 'thinking_delta') {
        const thinking = (event.delta as any).thinking
        if (thinking) dispatch({ type: 'reasoning', delta: thinking })
      } else if (event.type === 'content_block_delta' && (event.delta as any).type === 'input_json_delta') {
        const index = (event as any).index ?? 0
        const partialJson = (event.delta as any).partial_json ?? ''
        const tool = toolsByIndex.get(index)
        if (tool && partialJson) {
          tool.inputJson += partialJson
          dispatch({ type: 'tool_use_delta', toolCallId: tool.id, inputJsonDelta: partialJson })
        }
      } else if (event.type === 'content_block_stop') {
        const index = (event as any).index ?? 0
        const tool = toolsByIndex.get(index)
        if (tool && !tool.ended) {
          tool.ended = true
          dispatch({ type: 'tool_use_end', toolCallId: tool.id, finalInput: parseToolInput(tool.inputJson) })
        }
      } else if (event.type === 'message_delta') {
        const stopReason = (event as any).delta?.stop_reason
        if (stopReason === 'tool_use') finishReason = 'tool_use'
        if (stopReason === 'max_tokens') finishReason = 'length'
        if (event.usage) {
          dispatch({
            type: 'usage',
            inputTokens: (event as any).message?.usage?.input_tokens ?? 0,
            outputTokens: event.usage.output_tokens ?? 0
          })
        }
      }
    }

    if (!signal.aborted) {
      for (const tool of toolsByIndex.values()) {
        if (!tool.ended) {
          tool.ended = true
          dispatch({
            type: 'tool_use_end',
            toolCallId: tool.id,
            finalInput: parseToolInput(tool.inputJson)
          })
        }
      }

      const finalMsg = await stream.finalMessage()
      dispatch({
        type: 'usage',
        inputTokens: finalMsg.usage.input_tokens,
        outputTokens: finalMsg.usage.output_tokens
      })
    }

    return signal.aborted ? 'abort' : finishReason
  }

  private async streamOpenAI(
    req: CreateMessageRequest,
    modelId: string,
    apiKey: string,
    baseURL: string,
    signal: AbortSignal,
    dispatch: (event: BridgeStreamEvent) => void
  ): Promise<FinishReason> {
    const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true })
    const toolsByIndex = new Map<number, ToolAccumulator>()
    let finishReason: FinishReason = 'stop'
    const textNormalizer = new StreamTextNormalizer((delta) => dispatch({ type: 'text', delta }))

    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (req.systemPrompt) {
      messages.push({ role: 'system', content: req.systemPrompt })
    }
    for (const m of req.messages ?? []) {
      messages.push({
        role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as any,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      })
    }

    const stream = await client.chat.completions.create(
      { model: modelId, messages, stream: true, stream_options: { include_usage: true } },
      { signal }
    )
    logger.info('ChatermBridgeService: OpenAI-compatible stream created', {
      requestId: req.requestId,
      modelId,
      messageCount: messages.length
    })

    let sawChunk = false
    for await (const chunk of stream) {
      if (signal.aborted) break
      if (!sawChunk) {
        sawChunk = true
        logger.info('ChatermBridgeService: first OpenAI-compatible stream chunk received', {
          requestId: req.requestId,
          modelId,
          hasChoice: Boolean(chunk.choices[0]),
          hasUsage: Boolean(chunk.usage)
        })
      }
      const choice = chunk.choices[0]
      textNormalizer.push(choice?.delta?.content)
      // Reasoning models (e.g. GLM, DeepSeek-R1 behind OpenAI-compatible gateways)
      // stream their thinking in non-standard delta fields. Forward them so the
      // consumer sees activity — otherwise it may hit its first-event timeout
      // while the model is still reasoning.
      const reasoningDelta = (choice?.delta as { reasoning_content?: string; reasoning?: string } | undefined)?.reasoning_content ??
        (choice?.delta as { reasoning?: string } | undefined)?.reasoning
      if (reasoningDelta) dispatch({ type: 'reasoning', delta: reasoningDelta })
      for (const call of choice?.delta?.tool_calls ?? []) {
        const index = call.index ?? toolsByIndex.size
        const id = call.id ?? toolsByIndex.get(index)?.id ?? `tool-${index}`
        const name = call.function?.name ?? toolsByIndex.get(index)?.name ?? ''
        let tool = toolsByIndex.get(index)
        if (!tool) {
          tool = { id, name, inputJson: '', ended: false }
          toolsByIndex.set(index, tool)
          dispatch({ type: 'tool_use_start', toolCallId: tool.id, name: tool.name })
        } else {
          tool.id = id
          tool.name = name || tool.name
        }

        const argsDelta = call.function?.arguments ?? ''
        if (argsDelta) {
          tool.inputJson += argsDelta
          dispatch({ type: 'tool_use_delta', toolCallId: tool.id, inputJsonDelta: argsDelta })
        }
      }
      if (choice?.finish_reason === 'tool_calls' || choice?.finish_reason === 'function_call') {
        finishReason = 'tool_use'
      } else if (choice?.finish_reason === 'length') {
        finishReason = 'length'
      }
      if (chunk.usage) {
        dispatch({
          type: 'usage',
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens
        })
      }
    }

    if (!signal.aborted) {
      // Emit any text held back while classifying a content-parts stream.
      textNormalizer.end()
      for (const tool of toolsByIndex.values()) {
        if (!tool.ended) {
          tool.ended = true
          dispatch({ type: 'tool_use_end', toolCallId: tool.id, finalInput: parseToolInput(tool.inputJson) })
        }
      }
    }

    return signal.aborted ? 'abort' : finishReason
  }

  // ---------- abort ----------

  private handleAbort(requestId: string): void {
    const req = this.inFlight.get(requestId)
    if (req) {
      req.abortController.abort()
      req.finishAbort()
      this.inFlight.delete(requestId)
      logger.info('ChatermBridgeService: aborted request', { requestId })
    }
  }
}

export const chatermBridgeService = new ChatermBridgeService()
export default chatermBridgeService
