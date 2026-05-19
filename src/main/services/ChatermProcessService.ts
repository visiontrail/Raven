import path from 'node:path'

import { loggerService } from '@logger'
import { app } from 'electron'

const logger = loggerService.withContext('ChatermProcessService')

export interface ChatermProcessServiceOptions {
  bridge: import('./RavenLLMBridgeService').RavenLLMBridgeService
}

export class ChatermProcessService {
  private enabled = false
  private resourcesPath: string

  constructor(_options: ChatermProcessServiceOptions) {
    this.resourcesPath = path.join(app.getAppPath(), '..', 'chaterm')
  }

  async start(): Promise<void> {
    const fs = await import('node:fs/promises')
    const indexHtml = path.join(this.resourcesPath, 'index.html')
    const preloadJs = path.join(this.resourcesPath, 'preload.js')

    try {
      await fs.access(indexHtml)
      await fs.access(preloadJs)
      this.enabled = true
      logger.info('Chaterm resources found, Terminal tab enabled')
    } catch {
      this.enabled = false
      logger.warn('chaterm.assets.missing — index.html or preload.js not found, Terminal tab disabled', {
        resourcesPath: this.resourcesPath
      })
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }

  getResourcesPath(): string {
    return this.resourcesPath
  }

  async destroy(): Promise<void> {
    this.enabled = false
    logger.info('ChatermProcessService destroyed')
  }
}

export default ChatermProcessService
