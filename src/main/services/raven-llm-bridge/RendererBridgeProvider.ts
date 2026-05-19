import { loggerService } from '@logger'
import { ipcMain, type WebContents } from 'electron'

import {
  AvailableModel,
  BridgeError,
  BRIDGE_ERROR_CODES,
  BridgeProvider,
  BridgeStreamEvent,
  CreateMessageRequest,
  INTERNAL_CHANNELS
} from './types'

const logger = loggerService.withContext('RendererBridgeProvider')

/**
 * BridgeProvider implementation that delegates the actual LLM call to Raven's
 * main renderer (where AiProvider lives). The renderer subscribes to
 * `INTERNAL_CHANNELS.Execute` and emits `INTERNAL_CHANNELS.Event` packets keyed
 * by `requestId`.
 */
export class RendererBridgeProvider implements BridgeProvider {
  private eventListeners = new Map<string, (event: BridgeStreamEvent) => void>()
  private listenersAttached = false

  constructor(private readonly getRendererWebContents: () => WebContents | null) {}

  start(): void {
    if (this.listenersAttached) return
    ipcMain.on(INTERNAL_CHANNELS.Event, (_event, payload: { requestId: string; event: BridgeStreamEvent }) => {
      const listener = this.eventListeners.get(payload.requestId)
      if (!listener) return
      try {
        listener(payload.event)
      } catch (err) {
        logger.error('Event listener threw', err as Error, { requestId: payload.requestId })
      }
    })
    this.listenersAttached = true
  }

  destroy(): void {
    ipcMain.removeAllListeners(INTERNAL_CHANNELS.Event)
    this.eventListeners.clear()
    this.listenersAttached = false
  }

  async listAvailableModels(): Promise<AvailableModel[]> {
    const wc = this.requireRenderer()
    const models = (await this.invokeRenderer<AvailableModel[]>(wc, INTERNAL_CHANNELS.ListModels, {})) ?? []
    return models
  }

  async getDefaultModelId(): Promise<string | null> {
    const wc = this.requireRenderer()
    const result = await this.invokeRenderer<{ modelId: string | null }>(wc, INTERNAL_CHANNELS.ListModels, {
      defaultOnly: true
    })
    return result?.modelId ?? null
  }

  async createMessage(
    request: CreateMessageRequest,
    signal: AbortSignal,
    onEvent: (event: BridgeStreamEvent) => void
  ): Promise<void> {
    const wc = this.requireRenderer()
    this.eventListeners.set(request.requestId, onEvent)

    const onAbort = () => {
      wc.send(INTERNAL_CHANNELS.Abort, { requestId: request.requestId })
    }
    signal.addEventListener('abort', onAbort, { once: true })

    try {
      wc.send(INTERNAL_CHANNELS.Execute, request)
      await new Promise<void>((resolve) => {
        const previous = this.eventListeners.get(request.requestId)
        this.eventListeners.set(request.requestId, (event) => {
          previous?.(event)
          if (event.type === 'end') {
            resolve()
          }
        })
      })
    } finally {
      signal.removeEventListener('abort', onAbort)
      this.eventListeners.delete(request.requestId)
    }
  }

  private requireRenderer(): WebContents {
    const wc = this.getRendererWebContents()
    if (!wc || wc.isDestroyed()) {
      throw new BridgeError(BRIDGE_ERROR_CODES.BRIDGE_NOT_READY, 'Raven main renderer is not available')
    }
    return wc
  }

  /**
   * Round-trip a request to the renderer using a one-shot IPC reply channel.
   * The renderer-side handler sends back on `${channel}:reply:${nonce}`.
   */
  private invokeRenderer<T>(wc: WebContents, channel: string, payload: unknown): Promise<T> {
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`
    const replyChannel = `${channel}:reply:${nonce}`
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        ipcMain.removeAllListeners(replyChannel)
        reject(new BridgeError(BRIDGE_ERROR_CODES.BRIDGE_NOT_READY, `renderer did not reply to ${channel}`))
      }, 10_000)
      ipcMain.once(replyChannel, (_event, result: T) => {
        clearTimeout(timer)
        resolve(result)
      })
      wc.send(channel, { ...((payload as object) ?? {}), replyChannel })
    })
  }
}
