import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { loggerService } from '@logger'
import { app, type WebContents } from 'electron'

import { IpcChannel } from '@shared/IpcChannel'

import { getResourcePath } from '../utils'
import { registerChatermProtocolHandler, unregisterChatermProtocolHandler } from './chaterm/protocol'
import type { ChatermWebviewIdProvider } from './chaterm/registerChatermHandler'
import type { RavenLLMBridgeService } from './RavenLLMBridgeService'

/**
 * Raven → Chaterm session payload. Embedded mode fixes this to the upstream
 * guest identity (uid 999999999) — future work will replace `buildSessionPayload`
 * with the real Raven account once Raven gains an account system.
 */
export interface RavenSessionPayload {
  uid: number
  token: string
  isGuest: boolean
  name: string
}

function buildSessionPayload(): RavenSessionPayload {
  return { uid: 999999999, token: 'guest_token', isGuest: true, name: 'Guest' }
}

const logger = loggerService.withContext('ChatermProcessService')

/** Hard upper bound on cleanup during quit (spec §5.6). */
const DEFAULT_DESTROY_TIMEOUT_MS = 3_000

/** Signal payload mirrors Chaterm's MountChatermOptions surface. */
export interface ChatermMountOptions {
  webContentsId: number
  bridge: { registerAllowedSender(webContentsId: number): void }
  signals?: { onUnmount?: () => void | Promise<void> }
}

export type ChatermMountFn = (options: ChatermMountOptions) => Promise<void>
export type ChatermUnmountFn = () => Promise<void>

export interface ChatermProcessServiceOptions {
  bridge: RavenLLMBridgeService
  /**
   * Injection points for Chaterm's embedded entrypoint. In production these
   * come from `third_party/ChatermForRaven` once the build pipeline (§8) is
   * wired in. Default no-ops let Raven boot cleanly without the submodule
   * built — the bridge still works for unit tests and asset-missing scenarios.
   */
  mount?: ChatermMountFn
  unmount?: ChatermUnmountFn
  /** Override for tests; defaults to `<resources>/chaterm`. */
  resourcesPath?: string
}

export interface AttachOptions {
  /** Called once cleanup completes on render-process-gone. */
  onCrashed?: (details: Electron.RenderProcessGoneDetails) => void
}

export class ChatermProcessService implements ChatermWebviewIdProvider {
  private readonly bridge: RavenLLMBridgeService
  private readonly mount: ChatermMountFn
  private readonly unmount: ChatermUnmountFn
  private readonly resourcesPath: string

  private assetsAvailable = false
  private userEnabled = true
  private started = false
  private chatermWebContents: WebContents | null = null
  private chatermWebviewId: number | null = null
  /** Tracks `chaterm:*` handler disposers registered via {@link registerHandler}. */
  private readonly chatermHandlerDisposers = new Set<() => void>()

  constructor(options: ChatermProcessServiceOptions) {
    this.bridge = options.bridge
    this.mount = options.mount ?? noopMount
    this.unmount = options.unmount ?? noopUnmount
    // In packaged apps chaterm lands at process.resourcesPath/chaterm (extraResources).
    // In dev it lives under the project tree at app.getAppPath()/resources/chaterm.
    this.resourcesPath =
      options.resourcesPath ??
      (app.isPackaged ? path.join(process.resourcesPath, 'chaterm') : path.join(getResourcePath(), 'chaterm'))
  }

  // ---------- §5.1: assets check & startup ----------

  async start(): Promise<void> {
    if (this.started) return
    this.started = true

    const indexHtml = path.join(this.resourcesPath, 'index.html')
    const preloadJs = path.join(this.resourcesPath, 'preload.js')

    if (existsSync(indexHtml) && existsSync(preloadJs)) {
      this.assetsAvailable = true
      registerChatermProtocolHandler(this.resourcesPath)
      logger.info('Chaterm resources found, Terminal tab enabled', { resourcesPath: this.resourcesPath })
    } else {
      this.assetsAvailable = false
      logger.warn('chaterm.assets.missing — Terminal tab disabled', {
        resourcesPath: this.resourcesPath,
        indexHtml,
        preloadJs
      })
    }
  }

  isEnabled(): boolean {
    return this.started && this.assetsAvailable && this.userEnabled
  }

  /** Assets exist on disk — independent of the user's `terminal.enabled` toggle. */
  hasAssets(): boolean {
    return this.assetsAvailable
  }

  getResourcesPath(): string {
    return this.resourcesPath
  }

  /** Returns the preload script as a file:// URL, as required by the webview preload attribute. */
  getPreloadPath(): string {
    return pathToFileURL(path.join(this.resourcesPath, 'preload.js')).href
  }

  // ---------- §5.4: chaterm:* handler registration with sender validation ----------

  getChatermWebviewId(): number | null {
    return this.chatermWebviewId
  }

  /**
   * Track the disposer for a chaterm:* handler. Callers should use
   * {@link registerChatermHandler} from './chaterm/registerChatermHandler' and
   * pass the returned disposer here so render-process-gone can clean up.
   */
  trackChatermHandler(dispose: () => void): void {
    this.chatermHandlerDisposers.add(dispose)
  }

  // ---------- §5.3: webview attach lifecycle ----------

  async attachWebview(webContents: WebContents, options: AttachOptions = {}): Promise<void> {
    if (!this.isEnabled()) {
      throw new Error('ChatermProcessService is not enabled; refusing to attach webview')
    }
    if (this.chatermWebContents && !this.chatermWebContents.isDestroyed()) {
      if (this.chatermWebContents.id === webContents.id) {
        return
      }
      throw new Error(`Chaterm webview already attached (id=${this.chatermWebContents.id})`)
    }

    this.chatermWebContents = webContents
    this.chatermWebviewId = webContents.id

    // §5.5: clean up on crash.
    const crashHandler = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
      logger.error('Chaterm webview render process gone', undefined, {
        webContentsId: webContents.id,
        reason: details.reason,
        exitCode: details.exitCode
      })
      // Fire-and-forget; we cannot await an Electron event handler.
      void this.detachWebview('render-process-gone').then(() => {
        options.onCrashed?.(details)
      })
    }
    webContents.on('render-process-gone', crashHandler)

    // Defensive: if the webview is destroyed without firing render-process-gone
    // (e.g. user navigated the host), still detach.
    webContents.once('destroyed', () => {
      if (this.chatermWebviewId === webContents.id) {
        void this.detachWebview('destroyed')
      }
    })

    try {
      await this.mount({
        webContentsId: webContents.id,
        bridge: this.bridge,
        signals: {
          onUnmount: () => {
            /* signal hook for Chaterm-side cleanup; nothing to do on Raven side */
          }
        }
      })
      this.bridge.registerAllowedSender(webContents.id)
      const sessionPayload = buildSessionPayload()
      try {
        webContents.send(IpcChannel.Raven_UI_SetSession, sessionPayload)
      } catch (sendErr) {
        // Sending the session is best-effort: if the webview is destroyed
        // mid-attach, the renderer guard's timeout will surface the failure
        // via `notifyHostWarn`. We don't roll back mount for a transient send.
        logger.warn('Raven session send failed', { error: (sendErr as Error).message, webContentsId: webContents.id })
      }
      logger.info('Chaterm webview attached', { webContentsId: webContents.id, sessionGuest: sessionPayload.isGuest })
    } catch (err) {
      // Rollback partial state.
      webContents.off('render-process-gone', crashHandler)
      try {
        this.bridge.unregisterAllowedSender(webContents.id)
      } catch (rollbackErr) {
        logger.warn('Chaterm sender unregister rollback failed', { error: (rollbackErr as Error).message })
      }
      try {
        await this.unmount()
      } catch (rollbackErr) {
        logger.warn('Chaterm unmount rollback failed', { error: (rollbackErr as Error).message })
      }
      this.chatermWebContents = null
      this.chatermWebviewId = null
      throw err
    }
  }

  async detachWebview(reason: string = 'manual'): Promise<void> {
    if (!this.chatermWebContents) return

    const wc = this.chatermWebContents
    const id = this.chatermWebviewId ?? wc.id
    this.chatermWebContents = null
    this.chatermWebviewId = null

    // Remove all tracked chaterm:* handlers before unmount so any inflight
    // call is rejected synchronously.
    for (const dispose of this.chatermHandlerDisposers) {
      try {
        dispose()
      } catch (err) {
        logger.warn('chaterm handler disposer threw', { error: (err as Error).message })
      }
    }
    this.chatermHandlerDisposers.clear()

    try {
      this.bridge.unregisterAllowedSender(id)
    } catch (err) {
      logger.warn('Chaterm sender unregister failed', { error: (err as Error).message, webContentsId: id, reason })
    }

    try {
      await this.unmount()
    } catch (err) {
      logger.error('Chaterm unmount failed', err as Error, { webContentsId: id, reason })
    }

    logger.info('Chaterm webview detached', { webContentsId: id, reason })
  }

  // ---------- §5.7: terminal.enabled toggle ----------

  async setUserEnabled(enabled: boolean): Promise<void> {
    if (enabled === this.userEnabled) return
    this.userEnabled = enabled
    logger.info('Chaterm user-enabled state changed', { enabled })
    if (!enabled) {
      // Force detach; the renderer is responsible for destroying the <webview> element.
      await this.detachWebview('user-disabled')
    }
  }

  // ---------- §5.6: before-quit cleanup with timeout ----------

  async destroy(timeoutMs: number = DEFAULT_DESTROY_TIMEOUT_MS): Promise<void> {
    const detach = this.detachWebview('app-quit')
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), timeoutMs)
    })

    const result = await Promise.race([detach.then(() => 'ok' as const), timeout])
    if (timer) clearTimeout(timer)

    if (result === 'timeout') {
      logger.error('Chaterm cleanup exceeded timeout; forcing teardown', undefined, { timeoutMs })
    }

    unregisterChatermProtocolHandler()
    this.assetsAvailable = false
    this.started = false
    logger.info('ChatermProcessService destroyed', { reason: result })
  }
}

const noopMount: ChatermMountFn = async () => {
  // Replaced at wire-up time once the Chaterm submodule entrypoint is importable.
  logger.debug('Chaterm mount() called with no-op stub — Chaterm submodule not wired in this build')
}

const noopUnmount: ChatermUnmountFn = async () => {
  logger.debug('Chaterm unmount() called with no-op stub')
}

export default ChatermProcessService
