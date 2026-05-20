import { loggerService } from '@logger'
import { ipcMain, type IpcMainInvokeEvent } from 'electron'

const logger = loggerService.withContext('ChatermIpcGuard')

export const CHATERM_IPC_ERROR_CODES = {
  FORBIDDEN: 'E_CHATERM_IPC_FORBIDDEN'
} as const

export class ChatermIpcError extends Error {
  constructor(
    public readonly code: (typeof CHATERM_IPC_ERROR_CODES)[keyof typeof CHATERM_IPC_ERROR_CODES],
    message?: string
  ) {
    super(message ?? code)
    this.name = 'ChatermIpcError'
  }
}

/**
 * Provider that knows the current Chaterm webview's webContents id.
 * Implemented by {@link ChatermProcessService}; injected so the helper is
 * decoupled from any global state.
 */
export interface ChatermWebviewIdProvider {
  /** @returns the attached Chaterm webview's id, or null if not mounted. */
  getChatermWebviewId(): number | null
}

export type ChatermHandler<TArgs extends unknown[] = unknown[], TResult = unknown> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<TResult> | TResult

/**
 * Register an ipcMain.handle wrapper that rejects any sender that isn't the
 * currently-attached Chaterm webview. Returns a disposer that removes the
 * handler — call it on render-process-gone / unmount so a re-mount can
 * re-register cleanly.
 *
 * All channels passed here MUST use the `chaterm:` prefix; this is enforced
 * to keep the namespace boundary documented in the IpcChannel comment honest.
 */
export function registerChatermHandler<TArgs extends unknown[] = unknown[], TResult = unknown>(
  channel: string,
  provider: ChatermWebviewIdProvider,
  handler: ChatermHandler<TArgs, TResult>
): () => void {
  if (!channel.startsWith('chaterm:')) {
    throw new Error(`registerChatermHandler: channel "${channel}" must start with "chaterm:"`)
  }

  const wrapped = async (event: IpcMainInvokeEvent, ...args: unknown[]): Promise<TResult> => {
    const expectedId = provider.getChatermWebviewId()
    if (expectedId === null || event.sender.id !== expectedId) {
      logger.warn('Rejected chaterm IPC from unauthorized sender', {
        channel,
        senderId: event.sender.id,
        expectedId
      })
      throw new ChatermIpcError(CHATERM_IPC_ERROR_CODES.FORBIDDEN, `sender ${event.sender.id} is not the Chaterm webview`)
    }
    return handler(event, ...(args as TArgs))
  }

  ipcMain.handle(channel, wrapped)
  return () => {
    ipcMain.removeHandler(channel)
  }
}
