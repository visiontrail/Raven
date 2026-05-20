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
import { AvailableModel, BridgeStreamEvent, CreateMessageRequest, INTERNAL_CHANNELS } from '@shared/chaterm-bridge'
import OpenAI from 'openai'

const logger = loggerService.withContext('ChatermBridgeService')

/** Provider types with full tool-calling support in v1. */
const V1_FULL_TOOL_TYPES = new Set(['anthropic', 'openai', 'openai-response', 'azure-openai', 'mistral'])

/** Provider types kept in list but capabilities.tools=false for v1 gray. */
const V1_GRAY_TYPES = new Set(['gemini', 'vertexai', 'qwenlm', 'aws-bedrock'])

interface InFlightRequest {
  abortController: AbortController
}

class ChatermBridgeService {
  private readonly inFlight = new Map<string, InFlightRequest>()
  private started = false
  private readonly listeners: Array<() => void> = []

  start(): void {
    if (this.started) return
    this.started = true

    const ipc = window.electron.ipcRenderer

    const removeListModels = ipc.on(
      INTERNAL_CHANNELS.ListModels,
      (_event, payload: { replyChannel: string }) => {
        try {
          const models = this.buildAvailableModels()
          ipc.send(payload.replyChannel, models)
        } catch (err) {
          logger.error('ChatermBridgeService: listModels failed', err as Error)
          ipc.send(payload.replyChannel, [])
        }
      }
    )

    const removeExecute = ipc.on(
      INTERNAL_CHANNELS.Execute,
      (_event, req: CreateMessageRequest) => {
        void this.handleExecute(req)
      }
    )

    const removeAbort = ipc.on(
      INTERNAL_CHANNELS.Abort,
      (_event, payload: { requestId: string }) => {
        this.handleAbort(payload.requestId)
      }
    )

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
    const dispatch = (event: BridgeStreamEvent) => {
      ipc.send(INTERNAL_CHANNELS.Event, { requestId: req.requestId, event })
    }

    const modelId = req.modelId ?? getDefaultModel().id
    const provider = getProviderByModelId(modelId)

    if (!provider) {
      dispatch({ type: 'end', finishReason: 'error', error: 'provider not found for model' })
      return
    }

    const abortController = new AbortController()
    this.inFlight.set(req.requestId, { abortController })

    try {
      dispatch({ type: 'start', modelId, createdAt: Date.now() })
      await this.streamCompletion(req, modelId, provider, abortController.signal, dispatch)
      if (!abortController.signal.aborted) {
        dispatch({ type: 'end', finishReason: 'stop' })
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        dispatch({ type: 'end', finishReason: 'error', error: (err as Error).message })
      } else {
        dispatch({ type: 'end', finishReason: 'abort' })
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
  ): Promise<void> {
    const apiKey = (provider.apiKey ?? '').split(',')[0].trim()
    const pType = provider.type

    if (pType === 'anthropic') {
      await this.streamAnthropic(req, modelId, apiKey, provider.apiHost, signal, dispatch)
    } else if (['openai', 'openai-response', 'azure-openai', 'mistral', 'qwenlm'].includes(pType)) {
      await this.streamOpenAI(req, modelId, apiKey, provider.apiHost, signal, dispatch)
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
  ): Promise<void> {
    const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true })

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

      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        dispatch({ type: 'text', delta: event.delta.text })
      } else if (event.type === 'message_delta' && event.usage) {
        dispatch({
          type: 'usage',
          inputTokens: (event as any).message?.usage?.input_tokens ?? 0,
          outputTokens: event.usage.output_tokens ?? 0
        })
      }
    }

    if (!signal.aborted) {
      const finalMsg = await stream.finalMessage()
      dispatch({
        type: 'usage',
        inputTokens: finalMsg.usage.input_tokens,
        outputTokens: finalMsg.usage.output_tokens
      })
    }
  }

  private async streamOpenAI(
    req: CreateMessageRequest,
    modelId: string,
    apiKey: string,
    baseURL: string,
    signal: AbortSignal,
    dispatch: (event: BridgeStreamEvent) => void
  ): Promise<void> {
    const client = new OpenAI({ apiKey, baseURL, dangerouslyAllowBrowser: true })

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

    for await (const chunk of stream) {
      if (signal.aborted) break
      const delta = chunk.choices[0]?.delta?.content
      if (delta) dispatch({ type: 'text', delta })
      if (chunk.usage) {
        dispatch({
          type: 'usage',
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens
        })
      }
    }
  }

  // ---------- abort ----------

  private handleAbort(requestId: string): void {
    const req = this.inFlight.get(requestId)
    if (req) {
      req.abortController.abort()
      this.inFlight.delete(requestId)
      logger.info('ChatermBridgeService: aborted request', { requestId })
    }
  }
}

export const chatermBridgeService = new ChatermBridgeService()
export default chatermBridgeService
