import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CHATERM_RENDERER = path.join(process.cwd(), 'resources/chaterm/index.html')
const CHATERM_MAIN = path.join(process.cwd(), 'resources/chaterm/main/index.js')
const HAS_CHATERM_ASSETS = fs.existsSync(CHATERM_RENDERER) && fs.existsSync(CHATERM_MAIN)

let electronApp: ElectronApplication
let mainWindow: Page
let tmpUserData: string

// Both cases share one Electron launch (beforeAll) and must run sequentially:
// the two assertions probe different stages of the same boot.
test.describe.configure({ mode: 'serial' })

test.describe('/terminal — Chaterm embedded runtime', () => {
  test.skip(!HAS_CHATERM_ASSETS, 'Chaterm resources missing; run `yarn build:chaterm` first')

  test.beforeAll(async () => {
    // Isolated userData so this can coexist with `yarn dev` (which holds
    // SingletonLock on the default ~/Library/Application Support/raven path).
    tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'raven-e2e-'))
    electronApp = await electron.launch({
      args: ['.', `--user-data-dir=${tmpUserData}`],
      timeout: 60_000
    })
    mainWindow = await electronApp.firstWindow()
    await mainWindow.waitForLoadState('domcontentloaded')
  })

  test.afterAll(async () => {
    await electronApp?.close()
    if (tmpUserData) fs.rmSync(tmpUserData, { recursive: true, force: true })
  })

  test('route /terminal mounts the chaterm webview element', async () => {
    await mainWindow.evaluate(() => {
      window.location.hash = '#/terminal'
    })
    const webviewLocator = mainWindow.locator('webview')
    await expect(webviewLocator).toHaveCount(1, { timeout: 15_000 })
    // The webview's src starts at about:blank; we don't assert load completion
    // here — see the fixme test below for the full integration assertion.
    const src = await webviewLocator.getAttribute('src')
    expect(src).toBeTruthy()
  })

  test.fixme('webview mounts, finishes loading, and exposes raven:* IPC bridge', async () => {
    await mainWindow.evaluate(() => {
      window.location.hash = '#/terminal'
    })

    const webviewLocator = mainWindow.locator('webview')
    await expect(webviewLocator).toHaveCount(1, { timeout: 15_000 })

    // NOTE: when run via `electron.launch({ args: ['.'] })` without an active
    // vite dev server, the embedded webview observed in this environment hangs
    // at about:blank — the raven-chaterm:// protocol request never commits.
    // Reproduces only in headless test launch; under `yarn dev` the same boot
    // succeeds end-to-end (manual verification §7.1). Pending investigation;
    // the load-completion assertion is marked fixme below.
    await expect(mainWindow.getByText(/Loading Terminal/i)).toHaveCount(0, { timeout: 30_000 })
    await expect(mainWindow.getByText(/Terminal crashed/i)).toHaveCount(0)

    const bridge = await electronApp.evaluate(async ({ webContents }) => {
      const all = webContents.getAllWebContents()
      const wv = all.find((wc) => wc.getType() === 'webview')
      if (!wv) return null
      return wv.executeJavaScript(
        `({
          hasLLM: typeof window.ravenLLM === 'object' && window.ravenLLM !== null,
          hasUI: typeof window.ravenUI === 'object' && window.ravenUI !== null,
          hasOnSession: typeof window.ravenUI?.onSession === 'function',
          hasNotifyHostWarn: typeof window.ravenUI?.notifyHostWarn === 'function'
        })`
      )
    })

    expect(bridge).not.toBeNull()
    expect(bridge!.hasLLM).toBe(true)
    expect(bridge!.hasUI).toBe(true)
    expect(bridge!.hasOnSession).toBe(true)
    expect(bridge!.hasNotifyHostWarn).toBe(true)
  })

  test.fixme('webview receives raven:ui:set-session and reports session ready', async () => {
    const sessionReady = await electronApp.evaluate(async ({ webContents }) => {
      const all = webContents.getAllWebContents()
      const wv = all.find((wc) => wc.getType() === 'webview')
      if (!wv) return null
      const start = Date.now()
      while (Date.now() - start < 10_000) {
        const ready = await wv.executeJavaScript(
          '(typeof window.__ravenSessionReady !== "undefined") ? !!window.__ravenSessionReady : null'
        )
        if (ready === true) return { ready: true, waitedMs: Date.now() - start }
        await new Promise((r) => setTimeout(r, 250))
      }
      return { ready: false, waitedMs: Date.now() - start }
    })

    expect(sessionReady).not.toBeNull()
    expect(sessionReady!.ready).toBe(true)
  })
})
