import { loggerService } from '@logger'
import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

const logger = loggerService.withContext('IPAddressService')

/**
 * Main进程的IP地址服务
 * 用于从renderer进程获取动态IP地址
 */
export class MainIPAddressService {
  private static instance: MainIPAddressService | null = null
  private currentIP: string = '172.77.245.1' // 默认IP地址
  private isInitialized: boolean = false

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  /**
   * 获取服务实例（单例模式）
   */
  public static getInstance(): MainIPAddressService {
    if (!MainIPAddressService.instance) {
      MainIPAddressService.instance = new MainIPAddressService()
    }
    return MainIPAddressService.instance
  }

  /**
   * 初始化服务
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // 尝试获取当前IP地址
      await this.updateIPAddress()
      this.isInitialized = true
      logger.info('Main进程IP地址服务初始化完成', { currentIP: this.currentIP })
    } catch (error) {
      logger.error('Main进程IP地址服务初始化失败', error as Error)
      // 使用默认IP地址
      this.isInitialized = true
    }
  }

  /**
   * 获取当前IP地址
   */
  public getCurrentIP(): string {
    return this.currentIP
  }

  /**
   * 更新IP地址
   */
  public async updateIPAddress(): Promise<string> {
    try {
      // 通过IPC从renderer进程获取IP地址
      const ip = await this.getIPFromRenderer()
      if (ip && ip !== this.currentIP) {
        const oldIP = this.currentIP
        this.currentIP = ip
        logger.info('IP地址已更新', { oldIP, newIP: ip })
      }
      return this.currentIP
    } catch (error) {
      logger.error('更新IP地址失败', error as Error)
      return this.currentIP
    }
  }

  /**
   * 从renderer进程获取IP地址
   */
  private async getIPFromRenderer(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('获取IP地址超时'))
      }, 5000) // 5秒超时

      ipcMain.handle(IpcChannel.Mcp_GetSatelliteIP, async () => {
        try {
          clearTimeout(timeout)
          // 这里实际上会通过已注册的处理器来获取IP
          const ip = await this.requestIPFromRenderer()
          resolve(ip)
          return ip
        } catch (error) {
          reject(error)
          throw error
        }
      })
    })
  }

  /**
   * 向renderer进程请求IP地址
   */
  private async requestIPFromRenderer(): Promise<string> {
    // 这个方法会被IPC处理器调用
    // 实际的逻辑在main/ipc.ts中实现
    return this.currentIP
  }

  /**
   * 获取FTP配置（包含动态IP）
   */
  public getFTPConfig(): {
    host: string
    port: number
    user: string
    password: string
  } {
    return {
      host: this.getCurrentIP(),
      port: 21,
      user: 'anonymous',
      password: 'anonymous@example.com'
    }
  }
}

// 导出服务实例
export const mainIPAddressService = MainIPAddressService.getInstance()
export default MainIPAddressService
