import os from 'node:os'

import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { app, BrowserWindow, ipcMain } from 'electron'
import { WebSocket } from 'undici'

import { configManager } from './ConfigManager'
import {
  ClientToServerMessage,
  DEVICE_LINK_WS_PATH,
  DeviceCapabilities,
  PromptMessage,
  PromptResultMessage,
  RegisterMessage,
  ServerToClientMessage
} from './DeviceLinkContract'
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
  private connectAttempts = 0
  private promptTimers: Map<string, number> = new Map()
  private capabilities?: DeviceCapabilities
  private isRegistered = false

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
    this.promptTimers.clear()
    this.connectAttempts = 0
    this.isRegistered = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
    this.ws = undefined
  }

  restart() {
    this.stop()
    this.start()
  }

  private connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }

    const host = configManager.getRavenAIServiceHost()
    const port = configManager.getRavenAIServicePort()
    const url = `ws://${host}:${port}${DEVICE_LINK_WS_PATH}`

    const attempt = ++this.connectAttempts
    this.logger.info('Connecting to device link server', { url, attempt })

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
    this.logger.info('Device link connected', { attempts: this.connectAttempts })
    this.connectAttempts = 0
    this.reconnectDelay = RECONNECT_BASE_MS
    this.sendRegister()
  }

  private handleClose(event: any) {
    if (event?.target && this.ws && event.target !== this.ws) {
      return
    }

    this.logger.warn('Device link closed', { code: event?.code, reason: event?.reason })
    this.clearHeartbeat()
    this.promptTimers.clear()
    this.ws = undefined
    this.isRegistered = false

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
        this.isRegistered = true
        this.startHeartbeat()
        this.sendCapabilitiesUpdate()
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
    const mainWindow =
      this.mainWindow && !this.mainWindow.isDestroyed() ? this.mainWindow : windowService.getMainWindow()
    this.promptTimers.set(message.request_id, Date.now())
    this.logger.info('Prompt received from server', {
      requestId: message.request_id,
      sessionId: message.session_id,
      targetDeviceId: message.target_device_id
    })
    if (!mainWindow) {
      this.logger.warn('Cannot forward prompt, main window not available')
      this.promptTimers.delete(message.request_id)
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
    this.logger.info('Scheduling device link reconnect', { delay, nextAttempt: this.connectAttempts + 1 })

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
      models: [],
      capabilities: this.capabilities
    }

    this.sendMessage(message)
  }

  public updateCapabilities(capabilities: DeviceCapabilities) {
    this.capabilities = capabilities
    this.logger.info('Updated device capabilities for device link', {
      hasMcp: Boolean(capabilities?.mcp),
      mcpServers: capabilities?.mcp?.servers?.length || 0
    })
    this.sendCapabilitiesUpdate()
  }

  private sendCapabilitiesUpdate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }
    if (!this.isRegistered) {
      return
    }
    if (!this.capabilities) {
      return
    }

    const message: ClientToServerMessage = {
      type: 'capabilities_update',
      device_id: configManager.getDeviceLinkDeviceId(),
      capabilities: this.capabilities
    }

    this.logger.info('Sending capabilities update to device link server', {
      mcpServers: this.capabilities?.mcp?.servers?.length || 0
    })
    this.sendMessage(message)
  }

  private async sendPromptResult(payload: PromptResultMessage) {
    const startedAt = this.promptTimers.get(payload.request_id)
    const durationMs = startedAt ? Date.now() - startedAt : undefined
    if (!startedAt) {
      this.logger.warn('Prompt result sent without timing start', { requestId: payload.request_id })
    }
    this.promptTimers.delete(payload.request_id)
    this.logger.info('Forwarding prompt result to server', {
      requestId: payload.request_id,
      sessionId: payload.session_id,
      topicId: payload.topic_id,
      durationMs
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
