import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { loggerService } from '@logger'
import { net, protocol, session } from 'electron'

const logger = loggerService.withContext('ChatermProtocol')

export const CHATERM_SCHEME = 'raven-chaterm'

/**
 * Reasons {@link createChatermProtocolHandler} rejects a URL. Surfaced via
 * net.Response status codes so callers can distinguish a missing file from
 * a deliberate rejection.
 */
const STATUS_NOT_FOUND = 404
const STATUS_FORBIDDEN = 403

/**
 * Resolve a chaterm:// URL to a file path inside `resourcesPath`. Returns
 * `null` if the URL escapes the root via `..` or absolute components.
 * Exported for unit testing.
 */
export function resolveChatermFilePath(rawUrl: string, resourcesPath: string): string | null {
  // Defence in depth: Node's URL parser silently normalizes `..` segments away
  // (so `raven-chaterm://app/../foo` parses with pathname `/foo`), which would
  // mask a traversal attempt. We reject any URL whose raw or percent-encoded
  // form *looks* like traversal before parsing, regardless of where the
  // resolved path would actually land.
  if (/(^|\/|%2[Ff])(\.\.|%2[Ee]%2[Ee])(\/|$|%2[Ff])/.test(rawUrl)) {
    return null
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== `${CHATERM_SCHEME}:`) return null

  // raven-chaterm://app/foo/bar → request path is "/foo/bar"; we treat "app" as a
  // single virtual host so any other host is rejected (defence in depth).
  if (parsed.hostname && parsed.hostname !== 'app') return null

  const rawPath = decodeURIComponent(parsed.pathname || '/')
  if (rawPath.includes('\0')) return null
  const normalized = path.posix.normalize(rawPath).replace(/^\/+/, '')
  if (normalized === '' || normalized === '.') {
    return path.join(resourcesPath, 'index.html')
  }
  if (normalized.startsWith('..') || path.posix.isAbsolute(normalized)) {
    return null
  }

  const segments = normalized.split('/').filter(Boolean)

  const filePath = path.join(resourcesPath, ...segments)
  // Final containment check.
  const resolvedRoot = path.resolve(resourcesPath) + path.sep
  const resolvedFile = path.resolve(filePath)
  if (!(resolvedFile + path.sep).startsWith(resolvedRoot) && resolvedFile !== path.resolve(resourcesPath)) {
    return null
  }
  return resolvedFile
}

/**
 * Register the `raven-chaterm://` privileged scheme. Must be called BEFORE
 * `app.whenReady()` because Electron freezes scheme registration after ready.
 */
export function registerChatermProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CHATERM_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        codeCache: true
      }
    }
  ])
}

/** Partition name used by the Chaterm webview; must match ChatermWebviewHost.tsx. */
export const CHATERM_PARTITION = 'persist:chaterm'

/**
 * Register the protocol handler. Must be called after `app.whenReady()`.
 * Idempotent — calling twice replaces the previous handler.
 *
 * Registers in BOTH the default session (main BrowserWindow) and the
 * Chaterm webview's `persist:chaterm` partition session, because
 * `protocol.handle()` only covers the default session.
 */
export function registerChatermProtocolHandler(resourcesPath: string): void {
  const handler = async (request: Request): Promise<Response> => {
    const filePath = resolveChatermFilePath(request.url, resourcesPath)
    if (!filePath) {
      logger.warn('Rejected chaterm protocol request', { url: request.url })
      return new Response('forbidden', { status: STATUS_FORBIDDEN })
    }
    if (!existsSync(filePath)) {
      logger.debug('chaterm protocol asset not found', { filePath })
      return new Response('not found', { status: STATUS_NOT_FOUND })
    }
    return net.fetch(pathToFileURL(filePath).toString())
  }

  protocol.handle(CHATERM_SCHEME, handler)
  session.fromPartition(CHATERM_PARTITION).protocol.handle(CHATERM_SCHEME, handler)
  logger.info('Chaterm protocol handler registered', { scheme: CHATERM_SCHEME, resourcesPath })
}

/** Unregister the handler; safe to call even if nothing is registered. */
export function unregisterChatermProtocolHandler(): void {
  try {
    protocol.unhandle(CHATERM_SCHEME)
  } catch {
    // ignore — unhandle throws if no handler was registered
  }
  try {
    session.fromPartition(CHATERM_PARTITION).protocol.unhandle(CHATERM_SCHEME)
  } catch {
    // ignore
  }
}
