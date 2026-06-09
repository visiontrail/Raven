// src/main/services/__tests__/RavenLLMBridgeService.test.ts

import { ipcMain, webContents } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RavenLLMBridgeService } from '../RavenLLMBridgeService'
import {
  AvailableModel,
  BridgeError,
  BRIDGE_ERROR_CODES,
  BridgeProvider,
  BridgeStreamEvent,
  CreateMessageRequest,
  streamChannelFor
} from '../raven-llm-bridge/types'

const ALLOWED_SENDER_ID = 42
const ALIEN_SENDER_ID = 99

const ALLOWED_EVENT = { sender: { id: ALLOWED_SENDER_ID } } as Electron.IpcMainInvokeEvent
const ALIEN_EVENT = { sender: { id: ALIEN_SENDER_ID } } as Electron.IpcMainInvokeEvent

const SAMPLE_MODELS: AvailableModel[] = [
  {
    providerId: 'anthropic',
    modelId: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    capabilities: { tools: true, vision: true, streaming: true }
  }
]

function buildMockProvider(): BridgeProvider & {
  emit: (event: BridgeStreamEvent) => void
  resolve: () => void
  reject: (e: Error) => void
  lastSignal: AbortSignal | null
} {
  let onEvent: ((e: BridgeStreamEvent) => void) | null = null
  let resolveFn: (() => void) | null = null
  let rejectFn: ((e: Error) => void) | null = null
  let signalRef: AbortSignal | null = null

  return {
    listAvailableModels: vi.fn(async () => SAMPLE_MODELS),
    getDefaultModelId: vi.fn(async () => SAMPLE_MODELS[0].modelId),
    createMessage: vi.fn(async (_req, signal, cb) => {
      onEvent = cb
      signalRef = signal
      return new Promise<void>((resolve, reject) => {
        resolveFn = resolve
        rejectFn = reject
      })
    }),
    emit: (event) => onEvent?.(event),
    resolve: () => resolveFn?.(),
    reject: (e) => rejectFn?.(e),
    get lastSignal() {
      return signalRef
    }
  } as BridgeProvider & {
    emit: (event: BridgeStreamEvent) => void
    resolve: () => void
    reject: (e: Error) => void
    lastSignal: AbortSignal | null
  }
}

describe('RavenLLMBridgeService', () => {
  let service: RavenLLMBridgeService
  let provider: ReturnType<typeof buildMockProvider>
  let handlers: Record<string, (event: any, ...args: any[]) => any>
  let mockSender: { id: number; isDestroyed: () => boolean; send: ReturnType<typeof vi.fn> }
  let usageCalls: any[]

  beforeEach(() => {
    vi.clearAllMocks()

    handlers = {}
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers[channel] = handler
      return undefined as any
    })

    mockSender = {
      id: ALLOWED_SENDER_ID,
      isDestroyed: () => false,
      send: vi.fn()
    }
    // @ts-expect-error fromId is added at runtime
    webContents.fromId = vi.fn((id: number) => (id === ALLOWED_SENDER_ID ? mockSender : null))

    provider = buildMockProvider()
    usageCalls = []
    service = new RavenLLMBridgeService({
      provider,
      onUsage: (entry) => usageCalls.push(entry)
    })
    service.start()
    service.registerAllowedSender(ALLOWED_SENDER_ID)
  })

  afterEach(() => {
    service.destroy()
  })

  it('rejects listAvailableModels from unauthorized sender', async () => {
    await expect(handlers['raven:llm:listAvailableModels'](ALIEN_EVENT)).rejects.toMatchObject({
      code: BRIDGE_ERROR_CODES.BRIDGE_FORBIDDEN
    })
    expect(provider.listAvailableModels).not.toHaveBeenCalled()
  })

  it('returns models for authorized sender', async () => {
    const result = await handlers['raven:llm:listAvailableModels'](ALLOWED_EVENT)
    expect(result).toEqual(SAMPLE_MODELS)
  })

  it('rejects createMessage from unauthorized sender', async () => {
    await expect(
      handlers['raven:llm:createMessage'](ALIEN_EVENT, {
        requestId: 'r1',
        messages: []
      } as CreateMessageRequest)
    ).rejects.toBeInstanceOf(BridgeError)
  })

  it('strips credential fields silently and proceeds', async () => {
    const req: any = {
      requestId: 'r1',
      messages: [],
      apiKey: 'should-be-stripped',
      baseURL: 'https://evil.example.com'
    }
    await handlers['raven:llm:createMessage'](ALLOWED_EVENT, req)
    const passedReq = vi.mocked(provider.createMessage).mock.calls[0][0]
    expect((passedReq as any).apiKey).toBeUndefined()
    expect((passedReq as any).baseURL).toBeUndefined()
  })

  it('rejects unknown modelId with E_MODEL_NOT_AVAILABLE', async () => {
    await expect(
      handlers['raven:llm:createMessage'](ALLOWED_EVENT, {
        requestId: 'r1',
        messages: [],
        modelId: 'fake-model-x'
      } as CreateMessageRequest)
    ).rejects.toMatchObject({ code: BRIDGE_ERROR_CODES.MODEL_NOT_AVAILABLE })
  })

  it('uses default model when modelId omitted and rejects when none configured', async () => {
    vi.mocked(provider.getDefaultModelId).mockResolvedValueOnce(null)
    await expect(
      handlers['raven:llm:createMessage'](ALLOWED_EVENT, {
        requestId: 'r1',
        messages: []
      } as CreateMessageRequest)
    ).rejects.toMatchObject({ code: BRIDGE_ERROR_CODES.NO_DEFAULT_MODEL })
  })

  it('forwards text + usage + end events to sender on stream channel', async () => {
    const ack = await handlers['raven:llm:createMessage'](ALLOWED_EVENT, {
      requestId: 'req-1',
      messages: [{ role: 'user', content: 'hi' }]
    } as CreateMessageRequest)
    expect(ack).toEqual({ requestId: 'req-1' })

    // Wait a microtask so runRequest dispatches the `start` event.
    await Promise.resolve()
    await Promise.resolve()

    provider.emit({ type: 'text', delta: 'hello' })
    provider.emit({
      type: 'usage',
      inputTokens: 10,
      outputTokens: 5
    })
    provider.emit({ type: 'end', finishReason: 'stop' })
    provider.resolve()

    const channel = streamChannelFor('req-1')
    const sentEvents = mockSender.send.mock.calls.filter((c) => c[0] === channel).map((c) => c[1])
    expect(sentEvents[0]).toMatchObject({ type: 'start', modelId: SAMPLE_MODELS[0].modelId })
    expect(sentEvents).toContainEqual(expect.objectContaining({ type: 'text', delta: 'hello' }))
    expect(sentEvents.at(-1)).toEqual({ type: 'end', finishReason: 'stop' })

    expect(usageCalls).toHaveLength(1)
    expect(usageCalls[0]).toMatchObject({
      requestId: 'req-1',
      source: 'chaterm',
      inputTokens: 10,
      outputTokens: 5
    })
  })

  it('creates an in-process client for embedded Chaterm main Agent requests', async () => {
    const client = service.createInProcessClient()
    const events: BridgeStreamEvent[] = []
    const unsubscribe = client.onStreamEvent('req-client', (event) => events.push(event))

    const ack = await client.createMessage({
      requestId: 'req-client',
      messages: [{ role: 'user', content: 'hi' }]
    } as CreateMessageRequest)
    expect(ack).toEqual({ requestId: 'req-client' })

    await Promise.resolve()
    await Promise.resolve()

    provider.emit({ type: 'text', delta: 'embedded hello' })
    provider.emit({ type: 'usage', inputTokens: 3, outputTokens: 2 })
    provider.emit({ type: 'end', finishReason: 'stop' })
    provider.resolve()

    expect(events[0]).toMatchObject({ type: 'start', modelId: SAMPLE_MODELS[0].modelId })
    expect(events).toContainEqual({ type: 'text', delta: 'embedded hello' })
    expect(events.at(-1)).toEqual({ type: 'end', finishReason: 'stop' })
    expect(usageCalls[0]).toMatchObject({
      requestId: 'req-client',
      source: 'chaterm',
      inputTokens: 3,
      outputTokens: 2
    })

    unsubscribe()
  })

  it('abort emits end(finishReason=abort) within grace period and drops later events', async () => {
    vi.useFakeTimers()
    try {
      await handlers['raven:llm:createMessage'](ALLOWED_EVENT, {
        requestId: 'req-abort',
        messages: []
      } as CreateMessageRequest)
      await Promise.resolve()
      await Promise.resolve()

      const aborted = handlers['raven:llm:abort'](ALLOWED_EVENT, 'req-abort')
      expect(aborted).toEqual({ aborted: true })
      expect(provider.lastSignal?.aborted).toBe(true)

      // Provider keeps dribbling events after abort — they MUST be dropped.
      provider.emit({ type: 'text', delta: 'leaked-after-abort' })

      vi.advanceTimersByTime(1100)

      const channel = streamChannelFor('req-abort')
      const sent = mockSender.send.mock.calls.filter((c) => c[0] === channel).map((c) => c[1])
      const endEvents = sent.filter((e: BridgeStreamEvent) => e.type === 'end')
      expect(endEvents).toHaveLength(1)
      expect(endEvents[0]).toMatchObject({ type: 'end', finishReason: 'abort' })

      // No text event leaked.
      expect(sent.find((e: BridgeStreamEvent) => e.type === 'text' && (e as any).delta === 'leaked-after-abort')).toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('isSenderAllowed reflects allowlist mutations', () => {
    expect(service.isSenderAllowed(ALLOWED_SENDER_ID)).toBe(true)
    service.unregisterAllowedSender(ALLOWED_SENDER_ID)
    expect(service.isSenderAllowed(ALLOWED_SENDER_ID)).toBe(false)
  })
})
