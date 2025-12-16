import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { app, BrowserWindow, ipcMain } from 'electron'
import os from 'node:os'
import { WebSocket } from 'undici'

import {
  ClientToServerMessage,
  DEVICE_LINK_WS_PATH,
  PromptMessage,
  PromptResultMessage,
  RegisterMessage,
  ServerToClientMessage
} from './DeviceLinkContract'
import { configManager } from './ConfigManager'
import { windowService } from './WindowService'

const DEFAULT_HEARTBEAT_MS = 30_000
const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

class DeviceLinkClient {
  private ws?: WebSocket
  private mainWindow?: BrowserWindow
  private reconnectTimer?: NodeJS.Timeout
  private heartbeatTimer?: NodeJS.Timeout
  private reconnectDelay = RECONNECT_BASE_MS
  private heartbeatMs = DEFAULT_HEARTBEAT_MS
  private shouldReconnect = false
  private ipcRegistered = false

  private readonly logger = loggerService.withContext('DeviceLinkClient')

  attachMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  registerIpcHandlers() {
    if (this.ipcRegistered) return
    this.ipcRegistered = true

    ipcMain.handle(IpcChannel.DeviceLink_PromptResult, async (_event, payload: PromptResultMessage) => {
      await this.sendPromptResult(payload)
      return true
    })
  }

  start(mainWindow?: BrowserWindow) {
    if (mainWindow) {
      this.mainWindow = mainWindow
    }
    this.shouldReconnect = true
    this.connect()
  }

  stop() {
    this.shouldReconnect = false
    this.clearHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
    this.ws = undefined
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    const host = configManager.getRavenAIServiceHost()
    const port = configManager.getRavenAIServicePort()
    const url = `ws://${host}:${port}${DEVICE_LINK_WS_PATH}`

    this.logger.info('Connecting to device link server', { url })

    try {
      this.ws = new WebSocket(url)
    } catch (error) {
      this.logger.error('Failed to create WebSocket', error as Error)
      this.scheduleReconnect()
      return
    }

    this.ws.addEventListener('open', () => this.handleOpen())
    this.ws.addEventListener('close', (event) => this.handleClose(event))
    this.ws.addEventListener('error', (event) => this.handleError(event))
    this.ws.addEventListener('message', (event) => this.handleMessage(event))
  }

  private handleOpen() {
    this.logger.info('Device link connected')
    this.reconnectDelay = RECONNECT_BASE_MS
    this.sendRegister()
  }

  private handleClose(event: any) {
    this.logger.warn('Device link closed', { code: event?.code, reason: event?.reason })
    this.clearHeartbeat()
    this.ws = undefined

    if (this.shouldReconnect) {
      this.scheduleReconnect()
    }
  }

  private handleError(event: any) {
    this.logger.error('Device link error', event as Error)
  }

  private handleMessage(event: any) {
    if (typeof event?.data !== 'string') {
      this.logger.warn('Received non-text frame from device link, ignoring')
      return
    }

    let message: ServerToClientMessage
    try {
      message = JSON.parse(event.data) as ServerToClientMessage
    } catch (error) {
      this.logger.warn('Failed to parse device link message', { data: event.data, error })
      return
    }

    this.routeMessage(message)
  }

  private routeMessage(message: ServerToClientMessage) {
    switch (message.type) {
      case 'register_ack':
        this.heartbeatMs = (message.heartbeat_interval || DEFAULT_HEARTBEAT_MS / 1000) * 1000
        this.logger.info('Register ack received', {
          heartbeatMs: this.heartbeatMs,
          serverTime: message.server_time,
          deviceId: message.device_id
        })
        this.startHeartbeat()
        break

      case 'ping':
        this.sendMessage({ type: 'pong' })
        break

      case 'pong':
        this.logger.debug('Heartbeat pong received')
        break

      case 'prompt':
        this.handlePrompt(message)
        break

      case 'error':
        this.logger.warn('Device link error message', { message: message.message, requestId: message.request_id })
        break

      default:
        this.logger.warn('Unknown device link message type', { type: (message as any).type })
    }
  }

  private handlePrompt(message: PromptMessage) {
    const mainWindow = this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : windowService.getMainWindow()
    if (!mainWindow) {
      this.logger.warn('Cannot forward prompt, main window not available')
      return
    }

    // Optional acknowledgement to let server know the prompt is received.
    this.sendMessage({ type: 'prompt_ack', request_id: message.request_id, session_id: message.session_id })

    mainWindow.webContents.send(IpcChannel.DeviceLink_Prompt, message)
  }

  private startHeartbeat() {
    this.clearHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.sendMessage({ type: 'ping' })
    }, this.heartbeatMs || DEFAULT_HEARTBEAT_MS)
  }

  private clearHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldReconnect) return

    const delay = Math.min(this.reconnectDelay, RECONNECT_MAX_MS)
    this.logger.info('Scheduling device link reconnect', { delay })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, RECONNECT_MAX_MS)
      this.connect()
    }, delay)
  }

  private sendRegister() {
    const message: RegisterMessage = {
      type: 'register',
      device_id: configManager.getDeviceLinkDeviceId(),
      device_name: configManager.getDeviceLinkDeviceName(),
      client_version: app.getVersion(),
      host: os.hostname(),
      models: []
    }

    this.sendMessage(message)
  }

  private async sendPromptResult(payload: PromptResultMessage) {
    this.logger.info('Forwarding prompt result to server', {
      requestId: payload.request_id,
      sessionId: payload.session_id,
      topicId: payload.topic_id
    })
    this.sendMessage(payload)
  }

  private sendMessage(message: ClientToServerMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot send device link message, socket not open', { type: message.type })
      return
    }

    try {
      this.ws.send(JSON.stringify(message))
    } catch (error) {
      this.logger.error('Failed to send device link message', error as Error)
    }
  }
}

const deviceLinkClient = new DeviceLinkClient()

export default deviceLinkClient
