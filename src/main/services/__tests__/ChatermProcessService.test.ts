// src/main/services/__tests__/ChatermProcessService.test.ts
//
// Covers ChatermProcessService lifecycle (§5.1, §5.3, §5.5, §5.6, §5.7) and the
// `chaterm:` IPC sender-validation helper.

import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'

import { ipcMain } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { IpcChannel } from '@shared/IpcChannel'

import { ChatermProcessService } from '../ChatermProcessService'
import { resolveChatermFilePath } from '../chaterm/protocol'
import {
  CHATERM_IPC_ERROR_CODES,
  registerChatermHandler,
  type ChatermWebviewIdProvider
} from '../chaterm/registerChatermHandler'

// Local mock of `electron` — extends the global setup mock with the symbols
// these tests need (`protocol`, `webContents.fromId`, etc.). Hoisted by Vitest.
vi.mock('electron', async () => {
  const handlers: Record<string, (...args: any[]) => any> = {}
  const ipcMainMock = {
    handle: vi.fn((channel: string, h: any) => {
      handlers[channel] = h
    }),
    removeHandler: vi.fn((channel: string) => {
      delete handlers[channel]
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    __handlers: handlers
  }
  return {
    app: {
      getAppPath: vi.fn(() => '/mock/app'),
      getPath: vi.fn(() => '/mock/userData')
    },
    ipcMain: ipcMainMock,
    protocol: {
      registerSchemesAsPrivileged: vi.fn(),
      handle: vi.fn(),
      unhandle: vi.fn()
    },
    session: {
      fromPartition: vi.fn(() => ({
        protocol: {
          handle: vi.fn(),
          unhandle: vi.fn()
        }
      }))
    },
    net: {
      fetch: vi.fn(async () => new Response('ok'))
    },
    webContents: {
      fromId: vi.fn(),
      getAllWebContents: vi.fn(() => [])
    }
  }
})

// --- Mock the bridge — we only care that registerAllowedSender / unregisterAllowedSender
//     are called with the expected ids.
function makeBridgeStub() {
  const llmClient = {
    listAvailableModels: vi.fn(),
    createMessage: vi.fn(),
    abort: vi.fn(),
    onStreamEvent: vi.fn()
  }
  return {
    registerAllowedSender: vi.fn(),
    unregisterAllowedSender: vi.fn(),
    createInProcessClient: vi.fn(() => llmClient),
    // Other methods are not exercised here; cast through unknown.
    start: vi.fn(),
    destroy: vi.fn()
  }
}

/**
 * Minimal WebContents stand-in. EventEmitter gives us `.on` / `.once` / `.emit`.
 * The destroyed flag mirrors Electron's `isDestroyed()` behaviour.
 */
class FakeWebContents extends EventEmitter {
  public destroyed = false
  public send = vi.fn()
  constructor(public readonly id: number) {
    super()
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
}

describe('resolveChatermFilePath', () => {
  const ROOT = '/mock/resources/chaterm'

  it('resolves the root to index.html', () => {
    expect(resolveChatermFilePath('raven-chaterm://app/', ROOT)).toBe(`${ROOT}/index.html`)
  })

  it('resolves nested asset paths', () => {
    expect(resolveChatermFilePath('raven-chaterm://app/assets/main.js', ROOT)).toBe(`${ROOT}/assets/main.js`)
  })

  it('rejects path traversal via "../"', () => {
    expect(resolveChatermFilePath('raven-chaterm://app/../etc/passwd', ROOT)).toBeNull()
  })

  it('rejects encoded path traversal', () => {
    expect(resolveChatermFilePath('raven-chaterm://app/%2E%2E/secret', ROOT)).toBeNull()
  })

  it('rejects unexpected hostnames', () => {
    expect(resolveChatermFilePath('raven-chaterm://other/index.html', ROOT)).toBeNull()
  })

  it('rejects wrong scheme', () => {
    expect(resolveChatermFilePath('https://app/index.html', ROOT)).toBeNull()
  })

  it('rejects null bytes', () => {
    expect(resolveChatermFilePath('raven-chaterm://app/foo%00.html', ROOT)).toBeNull()
  })
})

describe('registerChatermHandler', () => {
  const CHATERM_ID = 7

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects channels missing the chaterm: prefix', () => {
    const provider: ChatermWebviewIdProvider = { getChatermWebviewId: () => CHATERM_ID }
    expect(() => registerChatermHandler('foo:bar', provider, async () => null)).toThrow(/must start with "chaterm:"/)
  })

  it('rejects calls from non-chaterm senders', async () => {
    const provider: ChatermWebviewIdProvider = { getChatermWebviewId: () => CHATERM_ID }
    const handler = vi.fn(async () => 'ok')
    registerChatermHandler('chaterm:ssh:connect', provider, handler)

    const registered = (ipcMain as any).__handlers['chaterm:ssh:connect']
    await expect(registered({ sender: { id: 99 } })).rejects.toMatchObject({
      code: CHATERM_IPC_ERROR_CODES.FORBIDDEN
    })
    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects calls before any webview is attached', async () => {
    const provider: ChatermWebviewIdProvider = { getChatermWebviewId: () => null }
    const handler = vi.fn(async () => 'ok')
    registerChatermHandler('chaterm:ssh:connect', provider, handler)

    const registered = (ipcMain as any).__handlers['chaterm:ssh:connect']
    await expect(registered({ sender: { id: CHATERM_ID } })).rejects.toMatchObject({
      code: CHATERM_IPC_ERROR_CODES.FORBIDDEN
    })
  })

  it('forwards calls from the registered Chaterm sender', async () => {
    const provider: ChatermWebviewIdProvider = { getChatermWebviewId: () => CHATERM_ID }
    const handler = vi.fn(async () => 'pong')
    registerChatermHandler('chaterm:ping', provider, handler)

    const registered = (ipcMain as any).__handlers['chaterm:ping']
    const result = await registered({ sender: { id: CHATERM_ID } }, 'arg1')
    expect(result).toBe('pong')
    expect(handler).toHaveBeenCalledWith({ sender: { id: CHATERM_ID } }, 'arg1')
  })

  it('disposer removes the handler', () => {
    const provider: ChatermWebviewIdProvider = { getChatermWebviewId: () => CHATERM_ID }
    const dispose = registerChatermHandler('chaterm:gone', provider, async () => null)
    expect((ipcMain as any).__handlers['chaterm:gone']).toBeDefined()
    dispose()
    expect((ipcMain as any).__handlers['chaterm:gone']).toBeUndefined()
  })
})

describe('ChatermProcessService', () => {
  const RESOURCES = '/mock/resources/chaterm'
  let bridge: ReturnType<typeof makeBridgeStub>

  beforeEach(() => {
    vi.clearAllMocks()
    bridge = makeBridgeStub()
  })

  afterEach(() => {
    vi.mocked(existsSync).mockReset()
  })

  it('marks the service disabled when assets are missing', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const svc = new ChatermProcessService({ bridge: bridge as any, resourcesPath: RESOURCES })
    await svc.start()
    expect(svc.isEnabled()).toBe(false)
    expect(svc.hasAssets()).toBe(false)
  })

  it('marks the service disabled when database assets are missing', async () => {
    vi.mocked(existsSync).mockImplementation((filePath) => !String(filePath).endsWith('/db/init_chaterm.db'))
    const svc = new ChatermProcessService({ bridge: bridge as any, resourcesPath: RESOURCES })
    await svc.start()
    expect(svc.isEnabled()).toBe(false)
    expect(svc.hasAssets()).toBe(false)
  })

  it('enables the service and registers the protocol when assets are present', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const svc = new ChatermProcessService({ bridge: bridge as any, resourcesPath: RESOURCES })
    await svc.start()
    expect(svc.isEnabled()).toBe(true)
    expect(svc.hasAssets()).toBe(true)
    const { protocol } = await import('electron')
    expect(protocol.handle).toHaveBeenCalledWith('raven-chaterm', expect.any(Function))
  })

  it('attaches a webview and registers it as an allowed bridge sender', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const calls: string[] = []
    const mount = vi.fn(async () => {})
    mount.mockImplementation(async () => {
      calls.push('mount')
    })
    bridge.registerAllowedSender.mockImplementation(() => {
      calls.push('register')
    })
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(101)
    await svc.attachWebview(wc as any)

    expect(bridge.registerAllowedSender).toHaveBeenCalledWith(101)
    expect(mount).toHaveBeenCalledWith(
      expect.objectContaining({
        webContentsId: 101,
        llmClient: expect.objectContaining({
          createMessage: expect.any(Function),
          onStreamEvent: expect.any(Function)
        })
      })
    )
    expect(calls).toEqual(['mount', 'register'])
    expect(svc.getChatermWebviewId()).toBe(101)
  })

  it('resends the Raven session when the same webview attaches again', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mount = vi.fn(async () => {})
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(101)
    await svc.attachWebview(wc as any)
    await svc.attachWebview(wc as any)

    expect(mount).toHaveBeenCalledTimes(1)
    expect(bridge.registerAllowedSender).toHaveBeenCalledTimes(1)
    expect(wc.send).toHaveBeenCalledTimes(2)
    expect(wc.send).toHaveBeenLastCalledWith(
      IpcChannel.Raven_UI_SetSession,
      expect.objectContaining({ uid: 999999999, token: 'guest_token', isGuest: true })
    )
  })

  it('attaches with the default no-op mount when the Chaterm main bundle is unavailable', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(102)
    await expect(svc.attachWebview(wc as any)).resolves.toBeUndefined()

    expect(bridge.registerAllowedSender).toHaveBeenCalledWith(102)
    expect(svc.getChatermWebviewId()).toBe(102)
  })

  it('refuses to attach when not enabled', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const svc = new ChatermProcessService({ bridge: bridge as any, resourcesPath: RESOURCES })
    await svc.start()
    const wc = new FakeWebContents(101)
    await expect(svc.attachWebview(wc as any)).rejects.toThrow(/not enabled/)
  })

  it('detaches and unregisters the sender on render-process-gone', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const unmount = vi.fn(async () => {})
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount: async () => {},
      unmount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(202)
    const onCrashed = vi.fn()
    await svc.attachWebview(wc as any, { onCrashed })

    wc.emit('render-process-gone', {}, { reason: 'crashed', exitCode: -1 })
    // Allow microtask queue for the async detach to settle.
    await new Promise((r) => setImmediate(r))

    expect(unmount).toHaveBeenCalledTimes(1)
    expect(bridge.unregisterAllowedSender).toHaveBeenCalledWith(202)
    expect(onCrashed).toHaveBeenCalledWith({ reason: 'crashed', exitCode: -1 })
    expect(svc.getChatermWebviewId()).toBeNull()
  })

  it('rolls back mount state when bridge sender registration fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mount = vi.fn(async () => {})
    const unmount = vi.fn(async () => {})
    bridge.registerAllowedSender.mockImplementation(() => {
      throw new Error('allowlist unavailable')
    })
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount,
      unmount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(212)
    await expect(svc.attachWebview(wc as any)).rejects.toThrow(/allowlist unavailable/)

    expect(mount).toHaveBeenCalledTimes(1)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(bridge.unregisterAllowedSender).toHaveBeenCalledWith(212)
    expect(svc.getChatermWebviewId()).toBeNull()
  })

  it('rolls back webContents state when Chaterm mount fails', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const mount = vi.fn(async () => {
      throw new Error('mount failed')
    })
    const unmount = vi.fn(async () => {})
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount,
      unmount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(213)
    await expect(svc.attachWebview(wc as any)).rejects.toThrow(/mount failed/)

    expect(bridge.registerAllowedSender).not.toHaveBeenCalled()
    expect(bridge.unregisterAllowedSender).toHaveBeenCalledWith(213)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(svc.getChatermWebviewId()).toBeNull()
  })

  it('tracked chaterm handlers are disposed on detach', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount: async () => {},
      unmount: async () => {},
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(303)
    await svc.attachWebview(wc as any)

    const disposer = vi.fn()
    svc.trackChatermHandler(disposer)
    await svc.detachWebview('test')
    expect(disposer).toHaveBeenCalledTimes(1)
  })

  it('detaches when terminal.enabled is toggled off', async () => {
    vi.mocked(existsSync).mockReturnValue(true)
    const unmount = vi.fn(async () => {})
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount: async () => {},
      unmount,
      resourcesPath: RESOURCES
    })
    await svc.start()

    const wc = new FakeWebContents(404)
    await svc.attachWebview(wc as any)

    await svc.setUserEnabled(false)
    expect(svc.isEnabled()).toBe(false)
    expect(unmount).toHaveBeenCalledTimes(1)
    expect(bridge.unregisterAllowedSender).toHaveBeenCalledWith(404)
  })

  it('destroy completes within the timeout even when unmount hangs', async () => {
    vi.useFakeTimers()
    vi.mocked(existsSync).mockReturnValue(true)
    let resolveHang: () => void = () => {}
    const unmount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveHang = resolve
        })
    )
    const svc = new ChatermProcessService({
      bridge: bridge as any,
      mount: async () => {},
      unmount,
      resourcesPath: RESOURCES
    })
    await svc.start()
    const wc = new FakeWebContents(505)
    await svc.attachWebview(wc as any)

    const destroyPromise = svc.destroy(50)
    await vi.advanceTimersByTimeAsync(60)
    await destroyPromise

    // Cleanly resolve so unhandled-promise leak detection stays clean.
    resolveHang()
    vi.useRealTimers()
  })
})
