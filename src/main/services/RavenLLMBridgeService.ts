import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain, type IpcMainInvokeEvent, webContents } from 'electron'

import {
  AvailableModel,
  BridgeError,
  BRIDGE_ERROR_CODES,
  BridgeProvider,
  BridgeStreamEvent,
  CreateMessageAck,
  CreateMessageRequest,
  streamChannelFor
} from './raven-llm-bridge/types'

const logger = loggerService.withContext('RavenLLMBridgeService')

const ABORT_GRACE_MS = 1000

interface ActiveRequest {
  requestId: string
  senderId: number
  abortController: AbortController
  startedAt: number
  modelId?: string
  ended: boolean
  abortTimer?: NodeJS.Timeout
}

export interface RavenLLMBridgeServiceOptions {
  /**
   * Provider implementation. Production wires a renderer-backed provider; tests pass a fake.
   * May be set after construction via {@link RavenLLMBridgeService.setProvider}.
   */
  provider?: BridgeProvider
  /**
   * Optional sink invoked after `usage` events so the Raven token-stats store can
   * record Chaterm-sourced consumption. Implementation lives outside the bridge.
   */
  onUsage?: (entry: {
    requestId: string
    modelId: string
    inputTokens: number
    outputTokens: number
    cacheRead?: number
    cacheWrite?: number
    source: 'chaterm'
  }) => void
}

export class RavenLLMBridgeService {
  private readonly allowedSenders = new Set<number>()
  private readonly activeRequests = new Map<string, ActiveRequest>()
  private provider: BridgeProvider | null
  private readonly onUsage?: RavenLLMBridgeServiceOptions['onUsage']
  private started = false

  constructor(options?: RavenLLMBridgeServiceOptions) {
    this.provider = options?.provider ?? null
    this.onUsage = options?.onUsage
    logger.info('RavenLLMBridgeService constructed')
  }

  /** Provider may be wired post-construction once the main renderer is ready. */
  setProvider(provider: BridgeProvider): void {
    this.provider = provider
  }

  registerAllowedSender(webContentsId: number): void {
    this.allowedSenders.add(webContentsId)
    logger.info('Registered allowed sender', { webContentsId })
  }

  unregisterAllowedSender(webContentsId: number): void {
    this.allowedSenders.delete(webContentsId)
    logger.info('Unregistered allowed sender', { webContentsId })
    // Abort any active requests originating from that sender
    for (const req of this.activeRequests.values()) {
      if (req.senderId === webContentsId) {
        this.abortRequest(req.requestId, 'sender-unregistered')
      }
    }
  }

  isSenderAllowed(webContentsId: number): boolean {
    return this.allowedSenders.has(webContentsId)
  }

  /** Register IPC handlers. Idempotent. */
  start(): void {
    if (this.started) return
    ipcMain.handle(IpcChannel.Raven_LLM_ListAvailableModels, (event) => this.handleListAvailableModels(event))
    ipcMain.handle(IpcChannel.Raven_LLM_CreateMessage, (event, req: CreateMessageRequest) =>
      this.handleCreateMessage(event, req)
    )
    ipcMain.handle(IpcChannel.Raven_LLM_Abort, (event, requestId: string) => this.handleAbort(event, requestId))
    this.started = true
    logger.info('Raven LLM Bridge IPC handlers registered')
  }

  destroy(): void {
    for (const req of this.activeRequests.values()) {
      req.abortController.abort()
      if (req.abortTimer) clearTimeout(req.abortTimer)
    }
    this.activeRequests.clear()
    this.allowedSenders.clear()
    if (this.started) {
      ipcMain.removeHandler(IpcChannel.Raven_LLM_ListAvailableModels)
      ipcMain.removeHandler(IpcChannel.Raven_LLM_CreateMessage)
      ipcMain.removeHandler(IpcChannel.Raven_LLM_Abort)
      this.started = false
    }
    logger.info('RavenLLMBridgeService destroyed')
  }

  // ---------- handlers ----------

  private async handleListAvailableModels(event: IpcMainInvokeEvent): Promise<AvailableModel[]> {
    this.assertSenderAllowed(event)
    const provider = this.requireProvider()
    return provider.listAvailableModels()
  }

  private async handleCreateMessage(
    event: IpcMainInvokeEvent,
    rawRequest: CreateMessageRequest
  ): Promise<CreateMessageAck> {
    this.assertSenderAllowed(event)
    const provider = this.requireProvider()
    const request = this.sanitizeRequest(rawRequest)

    // Resolve & validate model.
    let modelId = request.modelId
    if (!modelId) {
      modelId = (await provider.getDefaultModelId()) ?? undefined
      if (!modelId) {
        throw new BridgeError(BRIDGE_ERROR_CODES.NO_DEFAULT_MODEL, 'no default model configured in Raven')
      }
    } else {
      const available = await provider.listAvailableModels()
      if (!available.some((m) => m.modelId === modelId)) {
        throw new BridgeError(BRIDGE_ERROR_CODES.MODEL_NOT_AVAILABLE, `model "${modelId}" is not available`)
      }
    }

    const senderId = event.sender.id
    const abortController = new AbortController()
    const active: ActiveRequest = {
      requestId: request.requestId,
      senderId,
      abortController,
      startedAt: Date.now(),
      modelId,
      ended: false
    }
    this.activeRequests.set(request.requestId, active)

    logger.info('LLM request started', {
      requestId: request.requestId,
      modelId,
      source: 'chaterm',
      senderId,
      messageCount: request.messages?.length ?? 0
    })

    // Kick off the call. We deliberately do not await it here — the IPC reply
    // (`requestId`) is sent immediately; events stream over the dynamic channel.
    void this.runRequest(provider, { ...request, modelId }, active)

    return { requestId: request.requestId }
  }

  private handleAbort(event: IpcMainInvokeEvent, requestId: string): { aborted: boolean } {
    this.assertSenderAllowed(event)
    return { aborted: this.abortRequest(requestId, 'caller-requested') }
  }

  // ---------- request lifecycle ----------

  private async runRequest(
    provider: BridgeProvider,
    request: CreateMessageRequest & { modelId: string },
    active: ActiveRequest
  ): Promise<void> {
    const dispatch = (event: BridgeStreamEvent) => this.dispatchEvent(active, event)

    try {
      dispatch({ type: 'start', modelId: request.modelId, createdAt: Date.now() })
      await provider.createMessage(request, active.abortController.signal, (event) => {
        if (active.ended || active.abortController.signal.aborted) return
        if (event.type === 'usage') {
          this.onUsage?.({
            requestId: active.requestId,
            modelId: request.modelId,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cacheRead: event.cacheRead,
            cacheWrite: event.cacheWrite,
            source: 'chaterm'
          })
        }
        dispatch(event)
      })
      // Ensure we send a terminal `end` even if the provider did not.
      if (!active.ended) dispatch({ type: 'end', finishReason: 'stop' })
    } catch (err) {
      const isAbort = active.abortController.signal.aborted
      const finishReason = isAbort ? 'abort' : 'error'
      const message = err instanceof Error ? err.message : String(err)
      if (!active.ended) {
        dispatch({ type: 'end', finishReason, error: isAbort ? undefined : message })
      }
      if (!isAbort) {
        logger.error('LLM request failed', err as Error, {
          requestId: active.requestId,
          modelId: request.modelId,
          source: 'chaterm'
        })
      }
    }
  }

  private dispatchEvent(active: ActiveRequest, event: BridgeStreamEvent): void {
    if (active.ended) return
    const channel = streamChannelFor(active.requestId)

    if (event.type === 'end') {
      active.ended = true
      if (active.abortTimer) {
        clearTimeout(active.abortTimer)
        active.abortTimer = undefined
      }
      this.activeRequests.delete(active.requestId)
      logger.info('LLM request finished', {
        requestId: active.requestId,
        modelId: active.modelId,
        source: 'chaterm',
        finishReason: event.finishReason,
        durationMs: Date.now() - active.startedAt
      })
    }

    // Find the sender webContents and emit.
    const sender = this.findSender(active.senderId)
    if (sender && !sender.isDestroyed()) {
      sender.send(channel, event)
    }
  }

  private abortRequest(requestId: string, reason: string): boolean {
    const active = this.activeRequests.get(requestId)
    if (!active || active.ended) return false
    logger.info('LLM request aborting', { requestId, reason })
    active.abortController.abort()

    // Spec: within 1s of an abort, push `end(finishReason=abort)` even if the
    // provider hasn't acknowledged. Subsequent provider events are dropped because
    // `active.ended` is true.
    active.abortTimer = setTimeout(() => {
      if (!active.ended) {
        this.dispatchEvent(active, { type: 'end', finishReason: 'abort' })
      }
    }, ABORT_GRACE_MS)

    return true
  }

  // ---------- helpers ----------

  private assertSenderAllowed(event: IpcMainInvokeEvent): void {
    if (!this.allowedSenders.has(event.sender.id)) {
      logger.warn('Rejected bridge call from unauthorized sender', { senderId: event.sender.id })
      throw new BridgeError(BRIDGE_ERROR_CODES.BRIDGE_FORBIDDEN, 'sender not allowed')
    }
  }

  private requireProvider(): BridgeProvider {
    if (!this.provider) {
      throw new BridgeError(BRIDGE_ERROR_CODES.BRIDGE_NOT_READY, 'bridge provider not configured')
    }
    return this.provider
  }

  /**
   * Strip credential-bearing fields silently. Per spec, callers MUST NOT supply
   * apiKey / baseURL — we warn but do not error so a misbehaving caller can still
   * proceed against Raven-configured credentials.
   */
  private sanitizeRequest(raw: CreateMessageRequest): CreateMessageRequest {
    const r = raw as CreateMessageRequest & Record<string, unknown>
    let dirty = false
    for (const field of ['apiKey', 'baseURL', 'apiHost', 'token', 'authorization']) {
      if (field in r) {
        delete r[field]
        dirty = true
      }
    }
    if (dirty) {
      logger.warn('Stripped credential-bearing fields from createMessage payload', {
        requestId: raw.requestId
      })
    }
    if (!raw.requestId || typeof raw.requestId !== 'string') {
      throw new BridgeError(BRIDGE_ERROR_CODES.INVALID_REQUEST, 'requestId is required')
    }
    if (!Array.isArray(raw.messages)) {
      throw new BridgeError(BRIDGE_ERROR_CODES.INVALID_REQUEST, 'messages must be an array')
    }
    return r
  }

  private findSender(senderId: number): Electron.WebContents | null {
    try {
      return webContents.fromId(senderId) ?? null
    } catch {
      return null
    }
  }
}

export default RavenLLMBridgeService
