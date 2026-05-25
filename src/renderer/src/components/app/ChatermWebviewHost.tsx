import { isMac } from '@renderer/config/constant'
import { useTheme } from '@renderer/context/ThemeProvider'
import i18n from '@renderer/i18n'
import { useSettings } from '@renderer/hooks/useSettings'
import { useFullscreen } from '@renderer/hooks/useFullscreen'
import { IpcChannel } from '@shared/IpcChannel'
import { WebviewTag } from 'electron'
import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

type LoadState = 'idle' | 'loading' | 'loaded' | 'crashed'

/**
 * Renders and manages the Chaterm <webview> outside the Routes tree so the
 * process (and any live SSH sessions) survive route changes.
 *
 * §6.3 – webview src / preload / webpreferences
 * §6.4 – lazy first mount, display:none on tab-away
 * §6.5 – loading overlay
 * §6.6 – crash overlay + reload
 * §6.7 – block remote navigation
 * §6.8 – theme / locale broadcast
 * §6.9 – raven:ui:navigate reverse IPC
 */
const ChatermWebviewHost: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const { language } = useSettings()
  const isFullscreen = useFullscreen()
  const { t } = useTranslation()

  const webviewRef = useRef<WebviewTag | null>(null)
  // Track whether the webview has ever been mounted so we can keep it alive
  const everMountedRef = useRef(false)

  const [preloadUrl, setPreloadUrl] = useState<string | null>(null)
  const [hasAssets, setHasAssets] = useState(false)
  const [loadState, setLoadState] = useState<LoadState>('idle')

  const isVisible = location.pathname === '/terminal'

  // Mark as ever-mounted the first time the route becomes active
  if (isVisible && !everMountedRef.current) {
    everMountedRef.current = true
  }

  // Query Chaterm status once on mount
  useEffect(() => {
    window.api.chaterm.getStatus().then((status) => {
      setHasAssets(status.hasAssets)
      setPreloadUrl(status.preloadPath)
    })
  }, [])

  // §6.9: listen for raven:ui:navigate from Chaterm (via ipc-message OR from main process relay)
  useEffect(() => {
    const cleanup = window.api.chaterm.onNavigate((path) => {
      navigate(path)
    })
    return () => { cleanup() }
  }, [navigate])

  // §6.6: listen for crash notifications forwarded by the main process
  useEffect(() => {
    const cleanup = window.api.chaterm.onWebviewCrashed(() => {
      setLoadState('crashed')
    })
    return () => { cleanup() }
  }, [])

  // §6.8: broadcast theme changes to Chaterm webview
  useEffect(() => {
    if (loadState !== 'loaded' || !webviewRef.current) return
    webviewRef.current.send(IpcChannel.Raven_UI_ThemeChanged, { theme })
  }, [theme, loadState])

  // §6.8: broadcast locale changes to Chaterm webview
  useEffect(() => {
    if (loadState !== 'loaded' || !webviewRef.current) return
    webviewRef.current.send(IpcChannel.Raven_UI_LocaleChanged, { locale: i18n.language })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, loadState])

  const setRef = useCallback(
    (element: WebviewTag | null) => {
      webviewRef.current = element
      if (!element) return

      // §6.5: loading indicators
      const onStartLoading = () => setLoadState('loading')
      let attached = false
      const markLoaded = (origin: string) => {
        if (attached) return
        attached = true
        console.info('[ChatermWebviewHost] webview loaded via', origin)
        setLoadState('loaded')
        // Attach webview to ChatermProcessService via IPC so the bridge can validate senders
        const id = element.getWebContentsId()
        window.api.chaterm.attachWebview(id).catch((err) => {
          console.error('[ChatermWebviewHost] attachWebview failed:', err)
        })
        // Send initial theme + locale so Chaterm starts in sync
        element.send(IpcChannel.Raven_UI_ThemeChanged, { theme })
        element.send(IpcChannel.Raven_UI_LocaleChanged, { locale: i18n.language })
      }
      const onFinishLoad = () => markLoaded('did-finish-load')
      // Fallback: dom-ready fires earlier than did-finish-load and is sufficient
      // for Chaterm — once the document is parsed the renderer has bootstrapped.
      // Some embedded scenarios delay the window.onload event (e.g. lazy chunks
      // still in flight), leaving did-finish-load pending forever.
      const onDomReady = () => markLoaded('dom-ready')

      // §6.5: transition to crashed on load failure so the overlay doesn't hang
      const onFailLoad = (event: any) => {
        console.warn('[ChatermWebviewHost] did-fail-load', {
          errorCode: event.errorCode,
          errorDescription: event.errorDescription,
          validatedURL: event.validatedURL
        })
        if (event.errorCode !== -3) {
          // -3 is ERR_ABORTED (user-initiated navigation cancel), not a real failure
          setLoadState('crashed')
        }
      }

      // §6.7: block remote navigation — only allow raven-chaterm:// URLs
      const onWillNavigate = (event: any) => {
        if (!event.url?.startsWith('raven-chaterm://')) {
          event.preventDefault()
          window.api.shell.openExternal(event.url).catch(() => {})
        }
      }

      // §6.9: reverse IPC sent via ipcRenderer.sendToHost() in Chaterm preload
      const onIpcMessage = (event: any) => {
        if (event.channel === IpcChannel.Raven_UI_Navigate && event.args?.[0]) {
          navigate(event.args[0])
        }
      }

      element.addEventListener('did-start-loading', onStartLoading)
      element.addEventListener('did-finish-load', onFinishLoad)
      element.addEventListener('dom-ready', onDomReady)
      element.addEventListener('did-fail-load', onFailLoad)
      element.addEventListener('will-navigate', onWillNavigate)
      element.addEventListener('ipc-message', onIpcMessage)
    },
    // navigate and theme are captured by closure; they're stable enough
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleReload = useCallback(() => {
    setLoadState('loading')
    webviewRef.current?.reload()
  }, [])

  // Don't render anything if Chaterm resources aren't available
  if (!hasAssets || !preloadUrl) return null

  // §6.4: lazy — only mount the webview once the user first navigates to /terminal
  const shouldMount = everMountedRef.current

  return (
    <Host $visible={isVisible} $isFullscreen={isFullscreen}>
      {/* §6.5: loading overlay */}
      {isVisible && (loadState === 'idle' || loadState === 'loading') && (
        <Overlay>
          <LoadingText>{t('terminal.loading', 'Loading Terminal…')}</LoadingText>
        </Overlay>
      )}

      {/* §6.6: crash overlay */}
      {isVisible && loadState === 'crashed' && (
        <Overlay>
          <CrashText>{t('terminal.crashed', 'Terminal crashed')}</CrashText>
          <ReloadButton onClick={handleReload}>
            {t('terminal.reload', 'Reload')}
          </ReloadButton>
        </Overlay>
      )}

      {shouldMount && (
        <webview
          ref={setRef}
          src="raven-chaterm://app/index.html"
          preload={preloadUrl}
          /* §6.3: no node integration; context isolation on */
          nodeintegration={'false' as any}
          webpreferences="contextIsolation=yes,nodeIntegration=no"
          allowpopups={'false' as any}
          partition="persist:chaterm"
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            /* hide webview canvas when crashed; the overlay shows on top */
            display: loadState === 'crashed' ? 'none' : 'flex'
          }}
        />
      )}
    </Host>
  )
}

const Host = styled.div<{ $visible: boolean; $isFullscreen: boolean }>`
  display: ${({ $visible }) => ($visible ? 'flex' : 'none')};
  flex-direction: column;
  position: fixed;
  left: var(--sidebar-width);
  /* On Mac account for the native titlebar / drag region; skip in fullscreen */
  top: ${isMac ? ({ $isFullscreen }: { $isFullscreen: boolean }) => ($isFullscreen ? '0' : 'var(--navbar-height)') : '0'};
  right: 0;
  bottom: 0;
  z-index: 100;
  background-color: var(--color-background);
`

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  gap: 12px;
  color: var(--color-text-2);
  background-color: var(--color-background);
`

const LoadingText = styled.p`
  font-size: 14px;
  margin: 0;
`

const CrashText = styled.p`
  font-size: 15px;
  color: var(--color-text);
  margin: 0;
`

const ReloadButton = styled.button`
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  font-size: 14px;
  &:hover {
    background-color: var(--color-background-mute);
  }
`

export default ChatermWebviewHost
