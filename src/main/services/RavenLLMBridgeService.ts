import { loggerService } from '@logger'

const logger = loggerService.withContext('RavenLLMBridgeService')

export interface RavenLLMBridgeServiceOptions {
  // Reserved for future AiProviderFactory injection
}

export class RavenLLMBridgeService {
  private allowedSenders: Set<number> = new Set()

  constructor(_options?: RavenLLMBridgeServiceOptions) {
    logger.info('RavenLLMBridgeService created (stub)')
  }

  registerAllowedSender(webContentsId: number): void {
    this.allowedSenders.add(webContentsId)
    logger.info(`Registered allowed sender webContentsId=${webContentsId}`)
  }

  unregisterAllowedSender(webContentsId: number): void {
    this.allowedSenders.delete(webContentsId)
    logger.info(`Unregistered allowed sender webContentsId=${webContentsId}`)
  }

  isSenderAllowed(webContentsId: number): boolean {
    return this.allowedSenders.has(webContentsId)
  }

  destroy(): void {
    this.allowedSenders.clear()
    logger.info('RavenLLMBridgeService destroyed')
  }
}

export default RavenLLMBridgeService
